import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit(): Promise<void> {
    await this.$connect()
    if (process.env.DATABASE_URL?.startsWith('file:')) {
      await this.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
      await this.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    }
    await this.assertSeeded()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }

  // prisma/*.db 不入库：服务器上的库若未迁移/未播种，只会在前端看到 404，这里补一条明确的日志
  private async assertSeeded(): Promise<void> {
    try {
      const count = await this.question.count()
      if (count === 0) {
        this.logger.error(
          'Question 表为空，POST /api/answer 将返回 404「题目不存在或已下线」。请在服务器执行 npm run prisma:deploy（或 npx prisma migrate deploy && npm run prisma:seed）。',
        )
      }
    } catch (err) {
      this.logger.error(
        '数据库未初始化（Question 表不可用），请先执行 npx prisma migrate deploy 与 npm run prisma:seed。',
        err instanceof Error ? err.stack : String(err),
      )
    }
  }
}