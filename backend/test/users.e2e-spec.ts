import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { User } from '@prisma/client'
import { compare, hash } from 'bcrypt'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import type { UserRole } from '../src/auth/auth.constants'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

const PREFIX = 'e2e_users_'
const DEFAULT_PASSWORD = 'Password123'

describe('users (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let superToken: string
  let superAdminId: number
  let adminToken: string
  let viewerToken: string
  let viewerUser: User
  let targetUser: User
  let createdUserId: number | undefined

  function login(username: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
  }

  async function cleanup(): Promise<void> {
    await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
  }

  async function createAccount(username: string, role: UserRole): Promise<User> {
    return prisma.user.create({
      data: {
        username,
        passwordHash: await hash(DEFAULT_PASSWORD, 10),
        displayName: `${username} 显示名`,
        role,
        mustChangePassword: false,
      },
    })
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()

    prisma = app.get(PrismaService)
    await cleanup()

    // 确保默认超级管理员处于可登录状态（与 auth e2e 互不影响）
    const admin = await prisma.user.update({
      where: { username: 'admin' },
      data: {
        passwordHash: await hash('icppc2026', 10),
        role: 'super_admin',
        isActive: true,
        lastLoginAt: null,
      },
    })
    superAdminId = admin.id

    const adminLogin = await login('admin', 'icppc2026').expect(200)
    superToken = adminLogin.body.token as string

    const adminUser = await createAccount(`${PREFIX}admin`, 'admin')
    const adminLogin2 = await login(adminUser.username, DEFAULT_PASSWORD).expect(200)
    adminToken = adminLogin2.body.token as string

    viewerUser = await createAccount(`${PREFIX}viewer`, 'viewer')
    const viewerLogin = await login(viewerUser.username, DEFAULT_PASSWORD).expect(200)
    viewerToken = viewerLogin.body.token as string

    targetUser = await createAccount(`${PREFIX}target`, 'viewer')
  })

  afterAll(async () => {
    await cleanup()
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } })
    }
    await prisma.user.update({
      where: { username: 'admin' },
      data: { passwordHash: await hash('icppc2026', 10), role: 'super_admin', isActive: true },
    })
    await app.close()
  })

  function getUsers(query = '') {
    return request(app.getHttpServer())
      .get(`/api/users${query}`)
      .set('Authorization', `Bearer ${superToken}`)
  }

  it('requires a token', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401)
  })

  it('forbids admin and viewer roles', async () => {
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403)
  })

  it('lists users with pagination and never returns passwordHash', async () => {
    const res = await getUsers().expect(200)

    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.total).toBeGreaterThanOrEqual(3)
    expect(res.body.page).toBe(1)
    expect(res.body.pageSize).toBe(20)
    expect(res.body.totalPages).toBe(Math.ceil(res.body.total / 20))
    expect(res.body.items.every((u: Record<string, unknown>) => !('passwordHash' in u))).toBe(true)
  })

  it('filters by role and keyword and enforces pageSize cap', async () => {
    const filtered = await getUsers(`?role=viewer&keyword=${PREFIX}viewer`).expect(200)
    expect(filtered.body.items.map((u: { username: string }) => u.username)).toContain(
      viewerUser.username,
    )
    expect(filtered.body.items.every((u: { role: string }) => u.role === 'viewer')).toBe(true)

    const paged = await getUsers('?page=1&pageSize=2').expect(200)
    expect(paged.body.items).toHaveLength(2)

    await getUsers('?pageSize=101').expect(400)
  })

  it('creates an account with a bcrypt hashed password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        username: `${PREFIX}created`,
        password: DEFAULT_PASSWORD,
        displayName: '新建账号',
        role: 'viewer',
        email: 'created@example.com',
      })
      .expect(201)

    createdUserId = res.body.id as number
    expect(res.body).toMatchObject({
      username: `${PREFIX}created`,
      displayName: '新建账号',
      role: 'viewer',
      email: 'created@example.com',
      isActive: true,
      mustChangePassword: true,
    })
    expect(res.body).not.toHaveProperty('passwordHash')

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: createdUserId } })
    expect(saved.passwordHash).not.toBe(DEFAULT_PASSWORD)
    await expect(compare(DEFAULT_PASSWORD, saved.passwordHash)).resolves.toBe(true)
  })

  it('rejects duplicate usernames and invalid payloads', async () => {
    const duplicate = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        username: `${PREFIX}created`,
        password: DEFAULT_PASSWORD,
        displayName: '重复账号',
        role: 'viewer',
      })
      .expect(409)
    expect(duplicate.body.message).toBe('用户名已存在')

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        username: `${PREFIX}badrole`,
        password: DEFAULT_PASSWORD,
        displayName: '非法角色',
        role: 'owner',
      })
      .expect(400)

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        username: `${PREFIX}shortpwd`,
        password: '1234567',
        displayName: '短密码',
        role: 'viewer',
      })
      .expect(400)
  })

  it('updates displayName / email / isActive and hides passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ displayName: '目标账号改名', email: 'target@example.com', isActive: false })
      .expect(200)

    expect(res.body).toMatchObject({
      id: targetUser.id,
      displayName: '目标账号改名',
      email: 'target@example.com',
      isActive: false,
    })
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('prevents demoting self to viewer', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${superAdminId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ role: 'viewer' })
      .expect(400)
    expect(res.body.message).toBe('不能将自己降级为 viewer')
  })

  it('prevents demoting or disabling the last active super_admin', async () => {
    const demote = await request(app.getHttpServer())
      .patch(`/api/users/${superAdminId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ role: 'admin' })
      .expect(400)
    expect(demote.body.message).toBe('至少保留一个启用的超级管理员')

    const disable = await request(app.getHttpServer())
      .patch(`/api/users/${superAdminId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ isActive: false })
      .expect(400)
    expect(disable.body.message).toBe('至少保留一个启用的超级管理员')
  })

  it('returns 404 when updating a missing account', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/999999')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ displayName: '不存在' })
      .expect(404)
  })

  it('resets a password and forces change on next login', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${viewerUser.id}/password`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ newPassword: 'NewPassword123' })
      .expect(200)
    expect(res.body).toEqual({ success: true })

    await login(viewerUser.username, DEFAULT_PASSWORD).expect(401)

    const nextLogin = await login(viewerUser.username, 'NewPassword123').expect(200)
    expect(nextLogin.body.user.mustChangePassword).toBe(true)
  })

  it('rejects a too-short reset password', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/${viewerUser.id}/password`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ newPassword: 'short' })
      .expect(400)
  })

  it('prevents deleting self and returns 404 for missing accounts', async () => {
    const self = await request(app.getHttpServer())
      .delete(`/api/users/${superAdminId}`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(400)
    expect(self.body.message).toBe('不能删除当前登录账号')

    await request(app.getHttpServer())
      .delete('/api/users/999999')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(404)
  })

  it('deletes another account', async () => {
    await request(app.getHttpServer())
      .delete(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200)

    await request(app.getHttpServer())
      .delete(`/api/users/${targetUser.id}`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(404)

    const filtered = await getUsers(`?keyword=${PREFIX}target`).expect(200)
    expect(filtered.body.total).toBe(0)
  })
})
