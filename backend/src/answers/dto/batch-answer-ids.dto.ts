import { ApiProperty } from '@nestjs/swagger'
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator'

export class BatchAnswerIdsDto {
  @ApiProperty({
    type: [String],
    example: ['clx1234567890', 'clx0987654321'],
    description: 'Answer.id 是 cuid 字符串，不是数字',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[]
}
