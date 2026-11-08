import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator'
import { USER_ROLES, type UserRole } from '../../auth/auth.constants'

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value
}

function emptyToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: '张三', minLength: 1, maxLength: 64 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 64)
  displayName?: string

  @ApiPropertyOptional({ enum: [...USER_ROLES], example: 'admin' })
  @IsOptional()
  @IsIn([...USER_ROLES])
  role?: UserRole

  @ApiPropertyOptional({ example: 'zhangsan@example.com', nullable: true, maxLength: 128 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail()
  @MaxLength(128)
  email?: string | null

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
