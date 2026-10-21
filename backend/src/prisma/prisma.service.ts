import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect()
    if (process.env.DATABASE_URL?.startsWith('file:')) {
      await this.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
      await this.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}