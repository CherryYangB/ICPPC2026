import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY, type UserRole } from '../auth.constants'
import type { AuthenticatedUser } from '../types/authenticated-user.interface'

/**
 * 角色守卫，必须与 JwtAuthGuard 一起使用（顺序：JwtAuthGuard → RolesGuard）。
 * 未标注 @Roles() 时只要求已登录；标注后要求角色命中白名单。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) throw new UnauthorizedException('登录状态已失效，请重新登录')
    if (!required.includes(user.role)) {
      throw new ForbiddenException('当前账号无权执行该操作')
    }
    return true
  }
}
