import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class UpdateAnswerVisibilityDto {
  @ApiProperty({ example: true, description: 'true = 隐藏，false = 恢复显示' })
  @IsBoolean()
  isHidden!: boolean
}
