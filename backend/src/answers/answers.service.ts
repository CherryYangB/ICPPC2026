import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { QuestionsService } from '../questions/questions.service'
import { AnswersGateway } from '../realtime/answers.gateway'
import { IDENTITY_LABELS } from '../common/constants/identities'
import { CooldownException } from '../common/exceptions/cooldown.exception'
import type { NewAnswerEvent } from '../realtime/events'
import { CreateAnswerDto } from './dto/create-answer.dto'
import { SubmitAnswerResponseDto } from './dto/submit-answer-response.dto'
import { FixedWindowLimiter } from './rate-limiter'

@Injectable()
export class AnswersService {
  private readonly logger = new Logger(AnswersService.name)
  private readonly limiter: FixedWindowLimiter
  private readonly cooldownMs: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
    private readonly gateway: AnswersGateway,
    config: ConfigService,
  ) {
    const limit = config.get<number>('throttle.answer.limit', 20)
    const ttlMs = config.get<number>('throttle.answer.ttlMs', 60000)
    this.limiter = new FixedWindowLimiter(limit, ttlMs)
    this.cooldownMs = config.get<number>('answerCooldownMs', 30000)
  }

  async submit(dto: CreateAnswerDto, ip: string): Promise<SubmitAnswerResponseDto> {
    const order = await this.questionsService.findActiveOrder(dto.questionId)
    if (order === null) {
      throw new NotFoundException('题目不存在或已下线')
    }

    const consume = this.limiter.tryConsume(`${ip}|${dto.identityTag}`)
    if (!consume.ok) {
      throw new CooldownException(consume.retryAfterSeconds)
    }

    await this.assertCooldown(ip, dto.questionId)

    const created = await this.prisma.answer.create({
      data: {
        questionId: dto.questionId,
        identityTag: dto.identityTag,
        answer: dto.answer,
        clientIp: ip,
      },
    })

    const next = await this.questionsService.findNext(order)
    const labels = IDENTITY_LABELS[dto.identityTag]

    const payload: NewAnswerEvent = {
      id: created.id,
      questionId: created.questionId,
      questionOrder: order,
      identityTag: created.identityTag,
      identityTagZh: labels.zh,
      identityTagEn: labels.en,
      answer: created.answer,
      submittedAt: created.submittedAt.toISOString(),
    }

    try {
      this.gateway.broadcastNewAnswer(payload)
    } catch (err) {
      this.logger.error('Failed to broadcast newAnswer', err instanceof Error ? err.stack : String(err))
    }

    return {
      success: true,
      nextQuestionId: next?.id,
      completed: !next,
    }
  }

  private async assertCooldown(ip: string, questionId: string): Promise<void> {
    const cutoff = new Date(Date.now() - this.cooldownMs)
    const recent = await this.prisma.answer.findFirst({
      where: {
        clientIp: ip,
        questionId,
        submittedAt: { gt: cutoff },
      },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    })

    if (recent) {
      const elapsed = Date.now() - recent.submittedAt.getTime()
      const retryAfter = Math.max(1, Math.ceil((this.cooldownMs - elapsed) / 1000))
      throw new CooldownException(retryAfter)
    }
  }
}