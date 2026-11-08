import { Controller, Get, Res, StreamableFile } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { createReadStream } from 'node:fs'
import { QrInfoDto } from './dto/qr-info.dto'
import { QrService } from './qr.service'

/** 公共读取：大屏 / H5 获取当前二维码 */
@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly qrService: QrService) {}

  @Get('qr')
  @ApiOperation({ summary: '当前二维码元数据（未上传时 url = null）' })
  @ApiOkResponse({ type: QrInfoDto })
  getQr(): Promise<QrInfoDto> {
    return this.qrService.getInfo()
  }

  @Get('qr/image')
  @ApiOperation({ summary: '当前二维码图片' })
  async getQrImage(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const image = await this.qrService.getImage()
    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return new StreamableFile(createReadStream(image.filePath))
  }
}
