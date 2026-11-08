import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { USER_ROLES, type UserRole } from '../../auth/auth.constants'

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value
}

export class QueryUsersDto {
  @ApiPropertyOptional({ enum: [...USER_ROLES], description: '按角色精确筛选' })
  @IsOptional()
  @IsIn([...USER_ROLES])
  role?: UserRole

  @ApiPropertyOptional({ example: 'admin', description: '匹配 username / displayName / email' })
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
