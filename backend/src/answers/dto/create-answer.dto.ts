import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsIn, IsString, Length } from 'class-validator'
import { IDENTITIES, type IdentityTag } from '../../common/constants/identities'

export const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'] as const

export class CreateAnswerDto {
  @ApiProperty({ example: 'q3', enum: QUESTION_IDS })
  @IsIn([...QUESTION_IDS])
  questionId: string

  @ApiProperty({ example: 'physician', enum: IDENTITIES })
  @IsIn([...IDENTITIES])
  identityTag: IdentityTag

  @ApiProperty({ example: '加强基层儿科培训', maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  answer: string
}