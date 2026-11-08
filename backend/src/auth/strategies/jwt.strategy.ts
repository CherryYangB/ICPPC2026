import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { isUserRole } from '../auth.constants'
import type { AuthenticatedUser } from '../types/authenticated-user.interface'
import type { JwtPayload } from '../types/jwt-payload.interface'

/**
 * 每次请求都重新查库，保证账号被停用、角色被调整后立即生效。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret', ''),
    })
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const id = Number(payload?.sub)
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException('登录状态已失效，请重新登录')
    }

    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号不存在或已被停用')
    }
    if (!isUserRole(user.role)) {
      throw new UnauthorizedException('账号角色配置异常，请联系超级管理员')
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    }
  }
}
