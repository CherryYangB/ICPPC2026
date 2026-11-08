import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { IDENTITIES } from '../../common/constants/identities'
import { QUESTION_IDS } from './create-answer.dto'

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value
}

/** query 里的 true/false 字符串转 boolean；其他值原样交给 @IsBoolean 报 400 */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === true) return true
  if (value === 'false' || value === false) return false
  return value
}

export class QueryAdminAnswersDto {
  @ApiPropertyOptional({ enum: [...QUESTION_IDS], example: 'q3' })
  @IsOptional()
  @IsIn([...QUESTION_IDS])
  questionId?: string

  @ApiPropertyOptional({ enum: [...IDENTITIES], example: 'nurse' })
  @IsOptional()
  @IsIn([...IDENTITIES])
  identityTag?: string

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isHidden?: boolean

  @ApiPropertyOptional({ example: '培训', description: '回答内容包含匹配' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20
}
