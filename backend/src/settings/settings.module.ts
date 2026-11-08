import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminSettingsController } from './admin-settings.controller'
import { QrService } from './qr.service'
import { SettingsController } from './settings.controller'

@Module({
  imports: [AuthModule],
  controllers: [SettingsController, AdminSettingsController],
  providers: [QrService],
})
export class SettingsModule {}
