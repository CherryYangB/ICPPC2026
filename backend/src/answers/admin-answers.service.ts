import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AnswersGateway } from '../realtime/answers.gateway'
import { WordcloudScheduler } from '../wordcloud/wordcloud.scheduler'
import type { AdminAnswerDto, PaginatedAdminAnswersDto } from './dto/admin-answer.dto'
import type { BatchAnswerIdsDto } from './dto/batch-answer-ids.dto'
import type { QueryAdminAnswersDto } from './dto/query-admin-answers.dto'
import type { UpdateAnswerDto } from './dto/update-answer.dto'
import type { UpdateAnswerVisibilityDto } from './dto/update-answer-visibility.dto'

/** 管理端安全字段：不返回 clientIp */
const ANSWER_SELECT = {
  id: true,
  questionId: true,
  identityTag: true,
  answer: true,
  isHidden: true,
  submittedAt: true,
} satisfies Prisma.AnswerSelect

type AnswerRecord = Prisma.AnswerGetPayload<{ select: typeof ANSWER_SELECT }>

function toAdminAnswerDto(row: AnswerRecord): AdminAnswerDto {
  return {
    id: row.id,
    questionId: row.questionId,
    identityTag: row.identityTag,
    answer: row.answer,
    isHidden: row.isHidden,
    // 接口契约使用 createdAt，数据库中对应字段是 submittedAt
    createdAt: row.submittedAt,
  }
}

@Injectable()
export class AdminAnswersService {
  private readonly logger = new Logger(AdminAnswersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AnswersGateway,
    private readonly scheduler: WordcloudScheduler,
  ) {}

  async findAll(query: QueryAdminAnswersDto): Promise<PaginatedAdminAnswersDto> {
    const where: Prisma.AnswerWhereInput = {}
    if (query.questionId) where.questionId = query.questionId
    if (query.identityTag) where.identityTag = query.identityTag
    if (query.isHidden !== undefined) where.isHidden = query.isHidden

    const keyword = query.keyword?.trim()
    if (keyword) where.answer = { contains: keyword }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.answer.count({ where }),
      this.prisma.answer.findMany({
        where,
        select: ANSWER_SELECT,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return {
      items: rows.map(toAdminAnswerDto),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    }
  }

  /** 修改回答内容；词云需要重算 */
  async updateAnswer(id: string, dto: UpdateAnswerDto): Promise<AdminAnswerDto> {
    const existing = await this.findAnswerOrThrow(id)
    const updated = await this.prisma.answer.update({
      where: { id: existing.id },
      data: { answer: dto.answer },
      select: ANSWER_SELECT,
    })
    this.scheduler.markDirty(existing.questionId)
    return toAdminAnswerDto(updated)
  }

  /** 显式设置显示 / 隐藏；首次隐藏时广播 answerHidden */
  async setVisibility(
    id: string,
    dto: UpdateAnswerVisibilityDto,
  ): Promise<AdminAnswerDto> {
    const existing = await this.findAnswerOrThrow(id)
    if (existing.isHidden === dto.isHidden) {
      return toAdminAnswerDto(existing)
    }

    const updated = await this.prisma.answer.update({
      where: { id: existing.id },
      data: { isHidden: dto.isHidden },
      select: ANSWER_SELECT,
    })

    this.scheduler.markDirty(existing.questionId)
    if (dto.isHidden) {
      this.tryBroadcast('answerHidden', () =>
        this.gateway.broadcastAnswerHidden({ answerId: existing.id }),
      )
    }

    return toAdminAnswerDto(updated)
  }

  /** 删除回答；广播 answerDeleted 并刷新词云 */
  async remove(id: string): Promise<{ success: boolean }> {
    const existing = await this.findAnswerOrThrow(id)
    await this.prisma.answer.delete({ where: { id: existing.id } })
    this.scheduler.markDirty(existing.questionId)
    this.tryBroadcast('answerDeleted', () =>
      this.gateway.broadcastAnswerDeleted({ answerId: existing.id }),
    )
    return { success: true }
  }

  /** 批量隐藏：只处理当前未隐藏的记录，逐条广播 */
  async batchHide(dto: BatchAnswerIdsDto): Promise<{ updated: number }> {
    const ids = [...new Set(dto.ids)]
    const rows = await this.prisma.answer.findMany({
      where: { id: { in: ids }, isHidden: false },
      select: { id: true, questionId: true },
    })
    if (rows.length === 0) return { updated: 0 }

    const affectedIds = rows.map((row) => row.id)
    await this.prisma.answer.updateMany({
      where: { id: { in: affectedIds }, isHidden: false },
      data: { isHidden: true },
    })

    for (const row of rows) {
      this.tryBroadcast('answerHidden', () =>
        this.gateway.broadcastAnswerHidden({ answerId: row.id }),
      )
    }
    this.markQuestionsDirty(rows.map((row) => row.questionId))

    return { updated: rows.length }
  }

  /** 批量删除：只处理存在的记录，逐条广播 */
  async batchDelete(dto: BatchAnswerIdsDto): Promise<{ deleted: number }> {
    const ids = [...new Set(dto.ids)]
    const rows = await this.prisma.answer.findMany({
      where: { id: { in: ids } },
      select: { id: true, questionId: true },
    })
    if (rows.length === 0) return { deleted: 0 }

    const affectedIds = rows.map((row) => row.id)
    await this.prisma.answer.deleteMany({ where: { id: { in: affectedIds } } })

    for (const row of rows) {
      this.tryBroadcast('answerDeleted', () =>
        this.gateway.broadcastAnswerDeleted({ answerId: row.id }),
      )
    }
    this.markQuestionsDirty(rows.map((row) => row.questionId))

    return { deleted: rows.length }
  }

  private async findAnswerOrThrow(id: string): Promise<AnswerRecord> {
    const answer = await this.prisma.answer.findUnique({
      where: { id },
      select: ANSWER_SELECT,
    })
    if (!answer) {
      throw new NotFoundException('回答不存在')
    }
    return answer
  }

  private markQuestionsDirty(questionIds: readonly string[]): void {
    for (const questionId of new Set(questionIds)) {
      this.scheduler.markDirty(questionId)
    }
  }

  private tryBroadcast(event: string, fn: () => void): void {
    try {
      fn()
    } catch (err) {
      this.logger.error(
        `Failed to broadcast ${event}`,
        err instanceof Error ? err.stack : String(err),
      )
    }
  }
}
