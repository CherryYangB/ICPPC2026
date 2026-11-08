import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { InstitutionsController } from './institutions.controller'
import { InstitutionsService } from './institutions.service'

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
