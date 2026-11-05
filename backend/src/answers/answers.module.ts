import { Module } from '@nestjs/common'
import { QuestionsModule } from '../questions/questions.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { WordcloudModule } from '../wordcloud/wordcloud.module'
import { AnswersController } from './answers.controller'
import { AnswersService } from './answers.service'

@Module({
  imports: [QuestionsModule, RealtimeModule, WordcloudModule],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}