import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { InstitutionsModule } from '../institutions/institutions.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  imports: [AuthModule, InstitutionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
