import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { Prisma } from '@prisma/client'
import { hash } from 'bcrypt'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

const DEFAULT_USERNAME = 'admin'
const DEFAULT_PASSWORD = 'icppc2026'

describe('auth (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  async function resetAdmin(data: Prisma.UserUpdateInput = {}): Promise<void> {
    await prisma.user.update({
      where: { username: DEFAULT_USERNAME },
      data: {
        passwordHash: await hash(DEFAULT_PASSWORD, 10),
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: null,
        ...data,
      },
    })
  }

  function login(password = DEFAULT_PASSWORD) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: DEFAULT_USERNAME, password })
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
    await resetAdmin()
  })

  afterAll(async () => {
    await resetAdmin()
    await app.close()
  })

  it('logs in the seeded super admin and updates lastLoginAt', async () => {
    const res = await login().expect(200)

    expect(typeof res.body.token).toBe('string')
    expect(res.body.user).toMatchObject({
      username: DEFAULT_USERNAME,
      displayName: '超级管理员',
      role: 'super_admin',
      mustChangePassword: true,
    })
    expect(res.body.user).not.toHaveProperty('passwordHash')

    const saved = await prisma.user.findUnique({ where: { username: DEFAULT_USERNAME } })
    expect(saved?.lastLoginAt).toBeInstanceOf(Date)
  })

  it('rejects a wrong password with 401', async () => {
    const res = await login('wrong-password').expect(401)
    expect(res.body.message).toBe('用户名或密码错误')
  })

  it('rejects an unknown username with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'nobody', password: DEFAULT_PASSWORD })
      .expect(401)
  })

  it('rejects an empty body with 400', async () => {
    await request(app.getHttpServer()).post('/api/auth/login').send({}).expect(400)
  })

  it('returns 401 for /auth/me without a token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401)
  })

  it('returns the current user for /auth/me with a valid token', async () => {
    const loginRes = await login().expect(200)

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .expect(200)

    expect(res.body).toMatchObject({
      id: loginRes.body.user.id,
      username: DEFAULT_USERNAME,
      displayName: '超级管理员',
      role: 'super_admin',
      isActive: true,
      mustChangePassword: true,
    })
    expect(res.body).not.toHaveProperty('passwordHash')
  })

  it('rejects a deactivated account', async () => {
    await resetAdmin({ isActive: false })
    try {
      const res = await login().expect(401)
      expect(res.body.message).toBe('账号已被停用，请联系超级管理员')
    } finally {
      await resetAdmin()
    }
  })

  it('changes the password and clears mustChangePassword', async () => {
    await resetAdmin()
    const loginRes = await login().expect(200)
    const token = loginRes.body.token as string

    await request(app.getHttpServer())
      .post('/api/auth/password')
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'AnotherPass123' })
      .expect(401)

    const wrongCurrent = await request(app.getHttpServer())
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'AnotherPass123' })
      .expect(400)
    expect(wrongCurrent.body.message).toBe('当前密码不正确')

    await request(app.getHttpServer())
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'short' })
      .expect(400)

    try {
      const changed = await request(app.getHttpServer())
        .post('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'AnotherPass123' })
        .expect(200)
      expect(changed.body).toEqual({ success: true })

      await login().expect(401)
      const nextLogin = await login('AnotherPass123').expect(200)
      expect(nextLogin.body.user.mustChangePassword).toBe(false)
    } finally {
      await resetAdmin()
    }
  })
})
