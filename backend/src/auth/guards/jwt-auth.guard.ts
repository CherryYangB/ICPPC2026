import { ExecutionContext, HttpException, Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/** 校验 Authorization: Bearer <token>，失败统一返回中文 401 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser | false, _info: unknown, _context: ExecutionContext): TUser {
    if (err instanceof HttpException) throw err
    if (!user) throw new UnauthorizedException('登录状态已失效，请重新登录')
    return user
  }
}
