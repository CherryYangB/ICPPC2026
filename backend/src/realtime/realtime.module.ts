import { Module } from '@nestjs/common'
import { AnswersGateway } from './answers.gateway'

@Module({
  providers: [AnswersGateway],
  exports: [AnswersGateway],
})
export class RealtimeModule {}