import { ApiProperty } from '@nestjs/swagger'

export class InstitutionLitResponseDto {
  @ApiProperty({ example: true })
  success!: boolean

  @ApiProperty({ example: 12 })
  institutionId!: number

  @ApiProperty({ example: true })
  isLit!: boolean

  @ApiProperty({
    example: '2026-11-08T14:00:00.000Z',
    nullable: true,
    description: '点亮时间；isLit = false 时为 null',
  })
  litAt!: string | null
}
