import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CheckinResponseDto {
  @ApiProperty({ example: false, description: 'true = 已点亮或处于防刷冷却期内，未重复广播' })
  alreadyLit!: boolean

  @ApiPropertyOptional({ example: 12 })
  institutionId?: number

  @ApiPropertyOptional({ example: '2026-11-01T09:48:26.000Z', nullable: true })
  litAt?: string | null

  @ApiPropertyOptional({ example: 8 })
  litInstitutions?: number

  @ApiPropertyOptional({ example: 5 })
  litProvinces?: number
}
