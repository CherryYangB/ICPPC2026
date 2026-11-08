import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { User } from '@prisma/client'
import { compare, hash } from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { BCRYPT_ROUNDS, isUserRole, type UserRole } from './auth.constants'
import type { ChangePasswordDto } from './dto/change-password.dto'
import type { AuthUserDto, LoginResponseDto, UserProfileDto } from './dto/auth-user.dto'
import type { LoginDto } from './dto/login.dto'
import type { JwtPayload } from './types/jwt-payload.interface'

/**
 * 用户不存在时也执行一次 compare，避免通过响应时间枚举账号。
 * 固定哈希对应任意错误密码，只用于消耗同等时间。
 */
const DUMMY_PASSWORD_HASH = '$2b$10$6p6wLve47hF6hStT8c9PF.vWv/rIX43QS0fqYOR4dO2CnoMqvZHjW'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const username = dto.username.trim()
    const user = await this.prisma.user.findUnique({ where: { username } })

    const passwordMatches = await compare(dto.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH).catch(
      () => false,
    )
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('用户名或密码错误')
    }
    if (!user.isActive) {
      throw new UnauthorizedException('账号已被停用，请联系超级管理员')
    }
    if (!isUserRole(user.role)) {
      throw new UnauthorizedException('账号角色配置异常，请联系超级管理员')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    }
    const token = await this.jwtService.signAsync(payload)

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    }
  }

  /** 当前登录用户信息（JwtStrategy 已校验过账号状态，这里再查一次最新资料） */
  async me(userId: number): Promise<UserProfileDto> {
    const user = await this.findActiveUser(userId)
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      email: user.email,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }
  }

  /** 修改自己的密码；首次登录强制改密后 mustChangePassword 置 false */
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const user = await this.findActiveUser(userId)

    const currentMatches = await compare(dto.currentPassword, user.passwordHash).catch(() => false)
    if (!currentMatches) {
      throw new BadRequestException('当前密码不正确')
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('新密码不能与当前密码相同')
    }

    const passwordHash = await hash(dto.newPassword, BCRYPT_ROUNDS)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    })

    return { success: true }
  }

  private async findActiveUser(userId: number): Promise<User & { role: UserRole }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号不存在或已被停用')
    }
    if (!isUserRole(user.role)) {
      throw new UnauthorizedException('账号角色配置异常，请联系超级管理员')
    }
    return user as User & { role: UserRole }
  }
}

/** 供后续 users 模块复用的安全字段裁剪 */
export function toAuthUserDto(user: User & { role: UserRole }): AuthUserDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  }
}
