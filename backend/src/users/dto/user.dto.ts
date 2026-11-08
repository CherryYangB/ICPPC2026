import { ApiProperty } from '@nestjs/swagger'
import { USER_ROLES, type UserRole } from '../../auth/auth.constants'

/** 账号安全字段（永远不包含 passwordHash） */
export class UserDto {
  @ApiProperty({ example: 1 })
  id!: number

  @ApiProperty({ example: 'admin' })
  username!: string

  @ApiProperty({ example: '超级管理员' })
  displayName!: string

  @ApiProperty({ enum: [...USER_ROLES], example: 'super_admin' })
  role!: UserRole

  @ApiProperty({ example: 'admin@example.com', required: false, nullable: true })
  email!: string | null

  @ApiProperty({ example: true })
  isActive!: boolean

  @ApiProperty({ example: false })
  mustChangePassword!: boolean

  @ApiProperty({ example: '2026-11-08T14:23:18.061Z', required: false, nullable: true })
  lastLoginAt!: Date | null

  @ApiProperty({ example: '2026-11-08T14:20:43.510Z' })
  createdAt!: Date

  @ApiProperty({ example: '2026-11-08T14:20:43.510Z' })
  updatedAt!: Date
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserDto] })
  items!: UserDto[]

  @ApiProperty({ example: 1 })
  total!: number

  @ApiProperty({ example: 1 })
  page!: number

  @ApiProperty({ example: 20 })
  pageSize!: number

  @ApiProperty({ example: 1 })
  totalPages!: number
}

export class UserActionResponseDto {
  @ApiProperty({ example: true })
  success!: boolean
}
