import type { UserRole } from '../auth.constants'

/** JWT 载荷（exp / iat 由 jsonwebtoken 自动补充） */
export interface JwtPayload {
  /** User.id */
  sub: number
  username: string
  role: UserRole
}
