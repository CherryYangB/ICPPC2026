import { Module } from '@nestjs/common'
import { QuestionsModule } from '../questions/questions.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { AnswersController } from './answers.controller'
import { AnswersService } from './answers.service'

@Module({
  imports: [QuestionsModule, RealtimeModule],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}