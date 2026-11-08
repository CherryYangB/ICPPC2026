import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, type User } from '@prisma/client'
import { hash } from 'bcrypt'
import { BCRYPT_ROUNDS, type UserRole } from '../auth/auth.constants'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateUserDto } from './dto/create-user.dto'
import type { QueryUsersDto } from './dto/query-users.dto'
import type { ResetUserPasswordDto } from './dto/reset-password.dto'
import type { UpdateUserDto } from './dto/update-user.dto'
import type { PaginatedUsersDto, UserDto } from './dto/user.dto'

/** 安全字段：任何账号接口都不返回 passwordHash */
const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  email: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

type UserRecord = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>

function toUserDto(user: UserRecord): UserDto {
  return { ...user, role: user.role as UserRole }
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 账号列表：role / keyword 筛选 + 分页；不含 passwordHash */
  async findAll(query: QueryUsersDto): Promise<PaginatedUsersDto> {
    const where: Prisma.UserWhereInput = {}
    if (query.role) where.role = query.role

    const keyword = query.keyword?.trim()
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { displayName: { contains: keyword } },
        { email: { contains: keyword } },
      ]
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return {
      items: rows.map(toUserDto),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    }
  }

  /** 新增账号：用户名重复返回 409；新账号首次登录必须改密 */
  async create(dto: CreateUserDto): Promise<UserDto> {
    const username = dto.username.trim()
    const existing = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException('用户名已存在')
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS)
    try {
      const user = await this.prisma.user.create({
        data: {
          username,
          passwordHash,
          displayName: dto.displayName.trim(),
          role: dto.role,
          email: dto.email?.trim() || null,
          mustChangePassword: true,
        },
        select: USER_SELECT,
      })
      return toUserDto(user)
    } catch (err) {
      // 并发创建同名账号时兜底（P2002 = unique constraint）
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('用户名已存在')
      }
      throw err
    }
  }

  /** 修改资料 / 角色 / 启停；不允许把自己降级为 viewer，也不允许锁死最后一个启用的 super_admin */
  async update(id: number, dto: UpdateUserDto, currentUserId: number): Promise<UserDto> {
    const target = await this.findUserOrThrow(id)

    if (target.id === currentUserId && dto.role === 'viewer') {
      throw new BadRequestException('不能将自己降级为 viewer')
    }

    const nextRole = dto.role ?? target.role
    const nextIsActive = dto.isActive ?? target.isActive
    if (
      target.role === 'super_admin' &&
      target.isActive &&
      (nextRole !== 'super_admin' || !nextIsActive)
    ) {
      const remaining = await this.prisma.user.count({
        where: { role: 'super_admin', isActive: true, id: { not: target.id } },
      })
      if (remaining === 0) {
        throw new BadRequestException('至少保留一个启用的超级管理员')
      }
    }

    const data: Prisma.UserUpdateInput = {}
    if (dto.displayName !== undefined) data.displayName = dto.displayName.trim()
    if (dto.role !== undefined) data.role = dto.role
    if (dto.email !== undefined) data.email = dto.email?.trim() || null
    if (dto.isActive !== undefined) data.isActive = dto.isActive

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data,
      select: USER_SELECT,
    })
    return toUserDto(updated)
  }

  /** 重置密码：写回 bcrypt 哈希，并要求目标账号下次登录后改密 */
  async resetPassword(id: number, dto: ResetUserPasswordDto): Promise<{ success: boolean }> {
    const target = await this.findUserOrThrow(id)
    const passwordHash = await hash(dto.newPassword, BCRYPT_ROUNDS)

    await this.prisma.user.update({
      where: { id: target.id },
      data: { passwordHash, mustChangePassword: true },
    })
    return { success: true }
  }

  /** 删除账号：不能删除自己，也不能删除最后一个 super_admin */
  async remove(id: number, currentUserId: number): Promise<{ success: boolean }> {
    const target = await this.findUserOrThrow(id)

    if (target.id === currentUserId) {
      throw new BadRequestException('不能删除当前登录账号')
    }

    if (target.role === 'super_admin') {
      const remaining = await this.prisma.user.count({
        where: { role: 'super_admin', id: { not: target.id } },
      })
      if (remaining === 0) {
        throw new BadRequestException('不能删除最后一个超级管理员')
      }
    }

    await this.prisma.user.delete({ where: { id: target.id } })
    return { success: true }
  }

  private async findUserOrThrow(id: number): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new NotFoundException('账号不存在')
    }
    return user
  }
}
