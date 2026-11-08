import type { UserRole } from '../auth.constants'

/** JwtStrategy.validate 返回并挂到 request.user 的当前登录用户 */
export interface AuthenticatedUser {
  id: number
  username: string
  displayName: string
  role: UserRole
  email: string | null
  mustChangePassword: boolean
}
