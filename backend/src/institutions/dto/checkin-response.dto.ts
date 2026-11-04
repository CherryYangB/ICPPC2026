import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CheckinResponseDto {
  @ApiProperty({ example: true, description: '请求处理成功（错误统一返回 statusCode/message 结构）' })
  success!: boolean

  @ApiProperty({
    example: false,
    description: 'true = 该机构已点亮（或处于 10s 防刷窗口内），未重复广播，但统计数字仍为实时值',
  })
  alreadyLit!: boolean

  @ApiProperty({ example: 12 })
  institutionId!: number

  @ApiProperty({ example: '深圳市儿童医院' })
  nameZh!: string

  @ApiProperty({ example: '广东', description: '省份短名（已去掉「省/市/自治区」后缀）' })
  province!: string

  @ApiProperty({ example: '深圳市' })
  city!: string

  @ApiProperty({ example: 8, description: 'isLit = true 的机构总数（即打卡家数）' })
  litInstitutions!: number

  @ApiProperty({ example: 5, description: '已点亮机构所在省份去重数' })
  litProvinces!: number

  @ApiProperty({ example: 7, description: '已点亮机构所在城市去重数' })
  litCities!: number

  @ApiPropertyOptional({
    example: '2026-11-01T09:48:26.000Z',
    nullable: true,
    description: '点亮时间；已点亮取库中值，首次点亮为本次时间，冷却/并发分支为 null',
  })
  litAt?: string | null
}
