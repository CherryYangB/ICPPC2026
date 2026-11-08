import { BadRequestException, ConflictException } from '@nestjs/common'
import type { User } from '@prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import { UsersService } from './users.service'

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-11-08T00:00:00.000Z')
  return {
    id: 1,
    username: 'admin',
    passwordHash: 'hashed',
    displayName: '超级管理员',
    role: 'super_admin',
    email: null,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

interface MockPrisma {
  user: {
    findUnique: jest.Mock
    findMany: jest.Mock
    count: jest.Mock
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
  $transaction: jest.Mock
}

function createFixture(): { service: UsersService; prisma: MockPrisma } {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  }
  return {
    service: new UsersService(prisma as unknown as PrismaService),
    prisma: prisma as unknown as MockPrisma,
  }
}

describe('UsersService', () => {
  it('新增账号时用户名重复返回 409', async () => {
    const { service, prisma } = createFixture()
    prisma.user.findUnique.mockResolvedValue({ id: 2 })

    await expect(
      service.create({
        username: 'admin',
        password: 'Password123',
        displayName: '重复账号',
        role: 'viewer',
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('不能把自己降级为 viewer', async () => {
    const { service, prisma } = createFixture()
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 1 }))

    await expect(service.update(1, { role: 'viewer' }, 1)).rejects.toThrow(
      '不能将自己降级为 viewer',
    )
  })

  it('不能把最后一个启用的 super_admin 降级', async () => {
    const { service, prisma } = createFixture()
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 1, role: 'super_admin' }))
    prisma.user.count.mockResolvedValue(0)

    await expect(service.update(1, { role: 'admin' }, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('不能禁用最后一个启用的 super_admin', async () => {
    const { service, prisma } = createFixture()
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 1, role: 'super_admin' }))
    prisma.user.count.mockResolvedValue(0)

    await expect(service.update(1, { isActive: false }, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('存在其他启用的 super_admin 时允许降级', async () => {
    const { service, prisma } = createFixture()
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 1, role: 'super_admin' }))
    prisma.user.count.mockResolvedValue(1)
    const { passwordHash: _passwordHash, ...safeUser } = makeUser({ id: 1, role: 'admin' })
    prisma.user.update.mockResolvedValue(safeUser)

    const result = await service.update(1, { role: 'admin' }, 1)
    expect(result.role).toBe('admin')
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('不能删除自己', async () => {
    const { service, prisma } = createFixture()
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 1 }))

    await expect(service.remove(1, 1)).rejects.toThrow('不能删除当前登录账号')
  })

  it('不能删除最后一个 super_admin', async () => {
    const { service, prisma } = createFixture()
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 2, role: 'super_admin' }))
    prisma.user.count.mockResolvedValue(0)

    await expect(service.remove(2, 1)).rejects.toThrow('不能删除最后一个超级管理员')
  })

  it('可以删除普通账号', async () => {
    const { service, prisma } = createFixture()
    prisma.user.findUnique.mockResolvedValue(makeUser({ id: 3, role: 'viewer' }))
    prisma.user.delete.mockResolvedValue(makeUser({ id: 3, role: 'viewer' }))

    await expect(service.remove(3, 1)).resolves.toEqual({ success: true })
  })
})
