/** 后台角色白名单（SQLite 不使用 Prisma enum，统一在应用层校验） */
export const USER_ROLES = ['super_admin', 'admin', 'viewer'] as const

export type UserRole = (typeof USER_ROLES)[number]

/** 写操作允许的角色：viewer 只读 */
export const WRITE_ROLES: UserRole[] = ['super_admin', 'admin']

/** @Roles() 元数据 key */
export const ROLES_KEY = 'roles'

/** bcrypt 哈希轮数 */
export const BCRYPT_ROUNDS = 10

/**
 * 登录接口限流（@Throttle 元数据在类定义时求值，因此直接读 env）。
 * e2e 通过 test/setup-env.ts 放大，避免用例之间互相触发 429。
 */
export const LOGIN_THROTTLE = {
  default: {
    limit: Number(process.env.LOGIN_RATE_LIMIT ?? 5),
    ttl: Number(process.env.LOGIN_RATE_TTL_MS ?? 60000),
  },
} as const

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value)
}
