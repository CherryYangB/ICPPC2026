import { Module } from '@nestjs/common'
import { RealtimeModule } from '../realtime/realtime.module'
import { InstitutionsController } from './institutions.controller'
import { InstitutionsService } from './institutions.service'

@Module({
  imports: [RealtimeModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
