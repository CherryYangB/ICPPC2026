import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'

export class ChangePasswordDto {
  @ApiProperty({ example: 'icppc2026', maxLength: 72 })
  @IsString()
  @Length(1, 72)
  currentPassword!: string

  @ApiProperty({ example: 'NewStrongPass123', minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  newPassword!: string
}
