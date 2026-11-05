import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { WordcloudController } from './wordcloud.controller'
import { WordcloudScheduler } from './wordcloud.scheduler'
import { WordcloudService } from './wordcloud.service'

@Module({
  imports: [RealtimeModule],
  controllers: [WordcloudController],
  providers: [WordcloudService, WordcloudScheduler],
  exports: [WordcloudService, WordcloudScheduler],
})
export class WordcloudModule {}
