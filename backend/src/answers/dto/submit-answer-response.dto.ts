import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SubmitAnswerResponseDto {
  @ApiProperty({ example: true })
  success!: boolean

  @ApiPropertyOptional({ example: 'q4' })
  nextQuestionId?: string

  @ApiPropertyOptional({ example: false })
  completed?: boolean
}