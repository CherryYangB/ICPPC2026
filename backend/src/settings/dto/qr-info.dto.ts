import { ApiProperty } from '@nestjs/swagger'

export class QrInfoDto {
  @ApiProperty({
    example: '/api/settings/qr/image?v=1762614000000',
    nullable: true,
    description: '尚未上传二维码时为 null',
  })
  url!: string | null

  @ApiProperty({ example: 'image/jpeg', required: false })
  contentType?: string

  @ApiProperty({ example: 20480, required: false })
  size?: number

  @ApiProperty({ example: '2026-11-08T15:00:00.000Z', required: false })
  updatedAt?: string
}

export class QrUploadResponseDto {
  @ApiProperty({ example: true })
  success!: boolean

  @ApiProperty({ example: '/api/settings/qr/image?v=1762614000000' })
  url!: string

  @ApiProperty({ example: 'image/jpeg' })
  contentType!: string

  @ApiProperty({ example: 20480 })
  size!: number

  @ApiProperty({ example: '2026-11-08T15:00:00.000Z' })
  updatedAt!: string
}
