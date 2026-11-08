import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import configuration from './config/configuration'
import { validate } from './config/env.validation'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { SettingsModule } from './settings/settings.module'
import { HealthController } from './health/health.controller'
import { QuestionsModule } from './questions/questions.module'
import { InstitutionsModule } from './institutions/institutions.module'
import { AnswersModule } from './answers/answers.module'
import { RealtimeModule } from './realtime/realtime.module'
import { WordcloudModule } from './wordcloud/wordcloud.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    AuthModule,
    UsersModule,
    DashboardModule,
    SettingsModule,
    QuestionsModule,
    InstitutionsModule,
    AnswersModule,
    RealtimeModule,
    WordcloudModule,
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