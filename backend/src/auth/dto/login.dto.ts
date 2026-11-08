import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsString, Length } from 'class-validator'

export class LoginDto {
  @ApiProperty({ example: 'admin', maxLength: 64 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 64)
  username!: string

  @ApiProperty({ example: 'icppc2026', minLength: 1, maxLength: 72 })
  @IsString()
  @Length(1, 72)
  password!: string
}
