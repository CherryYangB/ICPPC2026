import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InstitutionsService } from '../institutions/institutions.service'
import { PrismaService } from '../prisma/prisma.service'
import type {
  AnswerByQuestionDto,
  DashboardOverviewDto,
  RecentActivityDto,
} from './dto/dashboard-overview.dto'

const DEFAULT_ONLINE_WINDOW_MINUTES = 10
const PREVIEW_LENGTH = 60

/** 北京时间（UTC+8）当天 00:00 对应的 UTC 时间 */
function startOfTodayUtc8(now = new Date()): Date {
  const offsetMs = 8 * 60 * 60 * 1000
  const shifted = new Date(now.getTime() + offsetMs)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - offsetMs,
  )
}

/** 回答预览：按 Unicode 字符截断，避免截断代理对 */
function toPreview(answer: string): string {
  const chars = Array.from(answer.trim())
  return chars.length > PREVIEW_LENGTH
    ? chars.slice(0, PREVIEW_LENGTH).join('') + '…'
    : chars.join('')
}

@Injectable()
export class DashboardService {
  private readonly onlineWindowMinutes: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly institutionsService: InstitutionsService,
    config: ConfigService,
  ) {
    const configured = config.get<number>(
      'onlineWindowMinutes',
      DEFAULT_ONLINE_WINDOW_MINUTES,
    )
    this.onlineWindowMinutes =
      Number.isInteger(configured) && configured > 0
        ? configured
        : DEFAULT_ONLINE_WINDOW_MINUTES
  }

  async getOverview(): Promise<DashboardOverviewDto> {
    const now = new Date()
    const todayStart = startOfTodayUtc8(now)
    const onlineCutoff = new Date(now.getTime() - this.onlineWindowMinutes * 60 * 1000)

    const [
      totalAnswers,
      todayAnswers,
      questions,
      groupedAnswers,
      stats,
      recentAnswers,
      recentCheckins,
      onlineRows,
    ] = await Promise.all([
      this.prisma.answer.count({ where: { isHidden: false } }),
      this.prisma.answer.count({
        where: { isHidden: false, submittedAt: { gte: todayStart } },
      }),
      this.prisma.question.findMany({
        orderBy: { order: 'asc' },
        select: { id: true, topicZh: true, color: true },
      }),
      this.prisma.answer.groupBy({
        by: ['questionId'],
        where: { isHidden: false },
        _count: { _all: true },
      }),
      this.institutionsService.getStats(),
      this.prisma.answer.findMany({
        where: { isHidden: false },
        orderBy: { submittedAt: 'desc' },
        take: 20,
        select: {
          questionId: true,
          answer: true,
          identityTag: true,
          submittedAt: true,
        },
      }),
      this.prisma.checkinRecord.findMany({
        orderBy: { checkedAt: 'desc' },
        take: 20,
        select: { nameZh: true, province: true, checkedAt: true },
      }),
      this.prisma.answer.findMany({
        where: {
          isHidden: false,
          clientIp: { not: null },
          submittedAt: { gte: onlineCutoff },
        },
        select: { clientIp: true },
        distinct: ['clientIp'],
      }),
    ])

    const countByQuestion = new Map<string, number>()
    for (const row of groupedAnswers) {
      countByQuestion.set(row.questionId, row._count._all)
    }

    const answersByQuestion: AnswerByQuestionDto[] = questions.map((question) => ({
      questionId: question.id,
      topicZh: question.topicZh,
      color: question.color,
      count: countByQuestion.get(question.id) ?? 0,
    }))

    const activities: RecentActivityDto[] = [
      ...recentAnswers.map<RecentActivityDto>((row) => ({
        type: 'answer',
        questionId: row.questionId,
        preview: toPreview(row.answer),
        identityTag: row.identityTag,
        createdAt: row.submittedAt.toISOString(),
      })),
      ...recentCheckins.map<RecentActivityDto>((row) => ({
        type: 'checkin',
        nameZh: row.nameZh,
        province: row.province,
        createdAt: row.checkedAt.toISOString(),
      })),
    ]
    activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return {
      totalAnswers,
      todayAnswers,
      onlineCount: onlineRows.length,
      litInstitutions: stats.litInstitutions,
      totalInstitutions: stats.totalInstitutions,
      litProvinces: stats.litProvinces,
      answersByQuestion,
      recentActivity: activities.slice(0, 20),
    }
  }
}
