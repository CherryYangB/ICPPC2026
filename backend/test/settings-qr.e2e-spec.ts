import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { hash } from 'bcrypt'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

const USER_PREFIX = 'e2e_qr_user_'
const PASSWORD = 'Password123'

// 只需文件头即可通过服务端 magic bytes 校验
const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
])
const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

describe('settings QR (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let superToken: string
  let adminToken: string
  let viewerToken: string
  const uploadDir = process.env.QR_UPLOAD_DIR ?? join(process.cwd(), 'uploads-test')

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  function login(username: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
  }

  async function createUser(name: string, role: string): Promise<void> {
    await prisma.user.create({
      data: {
        username: `${USER_PREFIX}${name}`,
        passwordHash: await hash(PASSWORD, 10),
        displayName: name,
        role,
        mustChangePassword: false,
      },
    })
  }

  async function cleanup(): Promise<void> {
    await rm(uploadDir, { recursive: true, force: true })
    await prisma.user.deleteMany({ where: { username: { startsWith: USER_PREFIX } } })
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    )
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()

    prisma = app.get(PrismaService)
    await cleanup()

    await prisma.user.update({
      where: { username: 'admin' },
      data: {
        passwordHash: await hash('icppc2026', 10),
        role: 'super_admin',
        isActive: true,
      },
    })
    superToken = (await login('admin', 'icppc2026').expect(200)).body.token as string

    await createUser('admin', 'admin')
    adminToken = (await login(`${USER_PREFIX}admin`, PASSWORD).expect(200)).body.token as string

    await createUser('viewer', 'viewer')
    viewerToken = (await login(`${USER_PREFIX}viewer`, PASSWORD).expect(200)).body.token as string
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('returns empty metadata before any upload and guards uploads', async () => {
    const info = await request(app.getHttpServer()).get('/api/settings/qr').expect(200)
    expect(info.body).toEqual({ url: null })

    await request(app.getHttpServer()).get('/api/settings/qr/image').expect(404)

    await request(app.getHttpServer())
      .post('/api/admin/settings/qr')
      .attach('file', JPEG_BUFFER, { filename: 'qr.jpg', contentType: 'image/jpeg' })
      .expect(401)

    await request(app.getHttpServer())
      .post('/api/admin/settings/qr')
      .set(auth(viewerToken))
      .attach('file', JPEG_BUFFER, { filename: 'qr.jpg', contentType: 'image/jpeg' })
      .expect(403)
  })

  it('uploads a JPEG and serves metadata plus image bytes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/settings/qr')
      .set(auth(superToken))
      .attach('file', JPEG_BUFFER, { filename: 'qr.jpg', contentType: 'image/jpeg' })
      .expect(201)

    expect(res.body).toMatchObject({
      success: true,
      contentType: 'image/jpeg',
      size: JPEG_BUFFER.length,
    })
    expect(res.body.url).toMatch(/^\/api\/settings\/qr\/image\?v=\d+$/)
    expect(existsSync(join(uploadDir, 'qr-participate.jpg'))).toBe(true)

    const info = await request(app.getHttpServer()).get('/api/settings/qr').expect(200)
    expect(info.body).toMatchObject({
      url: res.body.url,
      contentType: 'image/jpeg',
      size: JPEG_BUFFER.length,
    })

    const image = await request(app.getHttpServer())
      .get('/api/settings/qr/image')
      .expect(200)
    expect(image.headers['content-type']).toContain('image/jpeg')
    expect(Buffer.isBuffer(image.body)).toBe(true)
    expect((image.body as Buffer).equals(JPEG_BUFFER)).toBe(true)
  })

  it('replaces JPEG with PNG and deletes the old variant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/settings/qr')
      .set(auth(adminToken))
      .attach('file', PNG_BUFFER, { filename: 'qr.png', contentType: 'image/png' })
      .expect(201)

    expect(res.body).toMatchObject({
      success: true,
      contentType: 'image/png',
      size: PNG_BUFFER.length,
    })
    expect(existsSync(join(uploadDir, 'qr-participate.png'))).toBe(true)
    expect(existsSync(join(uploadDir, 'qr-participate.jpg'))).toBe(false)

    const info = await request(app.getHttpServer()).get('/api/settings/qr').expect(200)
    expect(info.body.contentType).toBe('image/png')

    const image = await request(app.getHttpServer())
      .get('/api/settings/qr/image')
      .expect(200)
    expect(image.headers['content-type']).toContain('image/png')
    expect((image.body as Buffer).equals(PNG_BUFFER)).toBe(true)
  })

  it('rejects non-image files and missing file fields', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/settings/qr')
      .set(auth(superToken))
      .attach('file', Buffer.from('not-an-image'), {
        filename: 'bad.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400)

    await request(app.getHttpServer())
      .post('/api/admin/settings/qr')
      .set(auth(superToken))
      .expect(400)

    const info = await request(app.getHttpServer()).get('/api/settings/qr').expect(200)
    expect(info.body.contentType).toBe('image/png')
  })
})
