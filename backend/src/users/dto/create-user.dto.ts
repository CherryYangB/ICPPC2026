import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator'
import { USER_ROLES, type UserRole } from '../../auth/auth.constants'

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value
}

function emptyToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export class CreateUserDto {
  @ApiProperty({ example: 'zhangsan', minLength: 3, maxLength: 64 })
  @Transform(trimString)
  @IsString()
  @Length(3, 64)
  username!: string

  @ApiProperty({ example: 'Password123', minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  password!: string

  @ApiProperty({ example: '张三', minLength: 1, maxLength: 64 })
  @Transform(trimString)
  @IsString()
  @Length(1, 64)
  displayName!: string

  @ApiProperty({ enum: [...USER_ROLES], example: 'viewer' })
  @IsIn([...USER_ROLES])
  role!: UserRole

  @ApiPropertyOptional({ example: 'zhangsan@example.com', nullable: true, maxLength: 128 })
  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail()
  @MaxLength(128)
  email?: string | null
}
