import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'

export class ResetUserPasswordDto {
  @ApiProperty({ example: 'NewPassword123', minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  newPassword!: string
}
