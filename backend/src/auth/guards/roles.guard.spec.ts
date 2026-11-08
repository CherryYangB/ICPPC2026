import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'
import type { UserRole } from '../auth.constants'
import type { AuthenticatedUser } from '../types/authenticated-user.interface'

function createContext(user?: Partial<AuthenticatedUser>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext
}

function createGuard(required: UserRole[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector
  return new RolesGuard(reflector)
}

function createUser(role: UserRole): Partial<AuthenticatedUser> {
  return {
    id: 1,
    username: 'tester',
    displayName: '测试用户',
    role,
    email: null,
    mustChangePassword: false,
  }
}

describe('RolesGuard', () => {
  it('未标注 @Roles 时只要求已登录', () => {
    expect(createGuard(undefined).canActivate(createContext(createUser('viewer')))).toBe(true)
  })

  it('admin 可执行写操作', () => {
    expect(createGuard(['super_admin', 'admin']).canActivate(createContext(createUser('admin')))).toBe(
      true,
    )
  })

  it('super_admin 可执行写操作', () => {
    expect(
      createGuard(['super_admin', 'admin']).canActivate(createContext(createUser('super_admin'))),
    ).toBe(true)
  })

  it('viewer 执行写操作返回 403', () => {
    expect(() =>
      createGuard(['super_admin', 'admin']).canActivate(createContext(createUser('viewer'))),
    ).toThrow(ForbiddenException)
  })

  it('缺少 request.user 时返回 401', () => {
    expect(() => createGuard(['super_admin']).canActivate(createContext(undefined))).toThrow(
      UnauthorizedException,
    )
  })
})
