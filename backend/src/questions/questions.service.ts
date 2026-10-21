import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { QuestionDto } from './dto/question.dto'

const QUESTION_SELECT = {
  id: true,
  order: true,
  topicZh: true,
  topicEn: true,
  color: true,
  titleZh: true,
  titleEn: true,
} as const

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<QuestionDto[]> {
    return this.prisma.question.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: QUESTION_SELECT,
    })
  }

  async findActiveOrder(id: string): Promise<number | null> {
    const question = await this.prisma.question.findFirst({
      where: { id, isActive: true },
      select: { order: true },
    })
    return question?.order ?? null
  }

  async findNext(afterOrder: number): Promise<{ id: string; order: number } | null> {
    return this.prisma.question.findFirst({
      where: { isActive: true, order: { gt: afterOrder } },
      orderBy: { order: 'asc' },
      select: { id: true, order: true },
    })
  }
}