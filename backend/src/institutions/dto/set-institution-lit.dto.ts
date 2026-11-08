import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class SetInstitutionLitDto {
  @ApiProperty({ example: true, description: 'true = 点亮（litAt 设为当前时间），false = 撤销点亮' })
  @IsBoolean()
  isLit!: boolean
}
