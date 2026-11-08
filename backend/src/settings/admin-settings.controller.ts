/// <reference types="multer" />
import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { QrUploadResponseDto } from './dto/qr-info.dto'
import { QR_MAX_BYTES, QrService } from './qr.service'

/** 后台设置：二维码上传（仅 admin / super_admin） */
@ApiTags('admin-settings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin')
export class AdminSettingsController {
  constructor(private readonly qrService: QrService) {}

  @Post('qr')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: QR_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传二维码（JPEG / PNG，最大 5 MB）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ type: QrUploadResponseDto })
  upload(@UploadedFile() file?: Express.Multer.File): Promise<QrUploadResponseDto> {
    return this.qrService.save(file)
  }
}
