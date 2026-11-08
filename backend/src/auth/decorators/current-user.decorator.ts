import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { AuthenticatedUser } from '../types/authenticated-user.interface'

/** 取 JwtStrategy 注入的当前用户；传字段名可直接取该字段 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) return undefined
    return field ? user[field] : user
  },
)
