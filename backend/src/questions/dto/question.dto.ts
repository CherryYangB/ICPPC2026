import { ApiProperty } from '@nestjs/swagger'

export class QuestionDto {
  @ApiProperty({ example: 'q1' })
  id: string

  @ApiProperty({ example: 1 })
  order: number

  @ApiProperty({ example: '症状管理' })
  topicZh: string

  @ApiProperty({ example: 'Symptom management' })
  topicEn: string

  @ApiProperty({ example: '#2f80ed' })
  color: string

  @ApiProperty({ example: '我们需要怎样的临床标准?' })
  titleZh: string

  @ApiProperty({ example: 'What clinical standards do we need?' })
  titleEn: string
}