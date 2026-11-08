import { ApiProperty } from '@nestjs/swagger'
import { USER_ROLES, type UserRole } from '../auth.constants'

/** 登录响应里的用户信息（契约：id / username / displayName / role） */
export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id!: number

  @ApiProperty({ example: 'admin' })
  username!: string

  @ApiProperty({ example: '超级管理员' })
  displayName!: string

  @ApiProperty({ enum: [...USER_ROLES], example: 'super_admin' })
  role!: UserRole

  @ApiProperty({ example: true, description: 'true 表示必须先修改密码后才能继续使用后台' })
  mustChangePassword!: boolean
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT，放在 Authorization: Bearer <token> 中' })
  token!: string

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto
}

/** GET /api/auth/me 返回的完整安全资料（绝不含 passwordHash） */
export class UserProfileDto extends AuthUserDto {
  @ApiProperty({ example: 'admin@example.com', required: false, nullable: true })
  email!: string | null

  @ApiProperty({ example: true })
  isActive!: boolean

  @ApiProperty({ example: '2026-11-01T09:00:00.000Z', required: false, nullable: true })
  lastLoginAt!: Date | null

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  createdAt!: Date
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: true })
  success!: boolean
}
