import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import configuration from './config/configuration'
import { validate } from './config/env.validation'
import { PrismaModule } from './prisma/prisma.module'
import { HealthController } from './health/health.controller'
import { QuestionsModule } from './questions/questions.module'
import { InstitutionsModule } from './institutions/institutions.module'
import { AnswersModule } from './answers/answers.module'
import { RealtimeModule } from './realtime/realtime.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.get<number>('throttle.global.ttlMs', 60000),
          limit: config.get<number>('throttle.global.limit', 120),
        },
      ],
    }),
    PrismaModule,
    QuestionsModule,
    InstitutionsModule,
    AnswersModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}