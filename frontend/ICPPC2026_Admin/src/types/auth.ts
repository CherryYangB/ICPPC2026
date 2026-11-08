export type UserRole = 'super_admin' | 'admin' | 'viewer'

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  viewer: '访客',
}

/** 登录 / 当前用户资料里的账号信息（与后端 AuthUserDto 对齐） */
export interface AuthUser {
  id: number
  username: string
  displayName: string
  role: UserRole
  mustChangePassword: boolean
}
