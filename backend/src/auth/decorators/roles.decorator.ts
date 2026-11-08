import { SetMetadata } from '@nestjs/common'
import { ROLES_KEY, type UserRole } from '../auth.constants'

/**
 * 标注接口允许的角色：
 * - `@Roles('super_admin', 'admin')` 写操作
 * - `@Roles('super_admin', 'admin', 'viewer')` 只读管理接口
 * 未标注时 RolesGuard 只要求已登录。
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles)
