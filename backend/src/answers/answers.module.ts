import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { QuestionsModule } from '../questions/questions.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { WordcloudModule } from '../wordcloud/wordcloud.module'
import { AdminAnswersController } from './admin-answers.controller'
import { AdminAnswersService } from './admin-answers.service'
import { AnswersController } from './answers.controller'
import { AnswersService } from './answers.service'

@Module({
  imports: [AuthModule, QuestionsModule, RealtimeModule, WordcloudModule],
  controllers: [AnswersController, AdminAnswersController],
  providers: [AnswersService, AdminAnswersService],
})
export class AnswersModule {}