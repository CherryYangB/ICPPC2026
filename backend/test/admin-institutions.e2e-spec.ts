import { INestApplication, ValidationPipe } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { Test } from '@nestjs/testing'
import type { Institution } from '@prisma/client'
import { hash } from 'bcrypt'
import { io, type Socket } from 'socket.io-client'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

const INST_PREFIX = 'e2e_admin_inst_'
const USER_PREFIX = 'e2e_admin_inst_user_'
const PASSWORD = 'Password123'

describe('admin institutions (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let baseUrl: string
  let superToken: string
  let adminToken: string
  let viewerToken: string
  let inst1: Institution
  let inst2: Institution

  const basePayload = {
    province: '测试省',
    city: '测试市',
    nameZh: `${INST_PREFIX}A`,
    hasWard: true,
    wardProjects: ['项目 A'],
    longitude: 120.1,
    latitude: 30.2,
    address: '测试地址',
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  function login(username: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
  }

  async function createUser(username: string, role: string): Promise<void> {
    await prisma.user.create({
      data: {
        username: `${USER_PREFIX}${username}`,
        passwordHash: await hash(PASSWORD, 10),
        displayName: username,
        role,
        mustChangePassword: false,
      },
    })
  }

  async function cleanup(): Promise<void> {
    await prisma.institution.deleteMany({ where: { nameZh: { startsWith: INST_PREFIX } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: USER_PREFIX } } })
  }

  async function connectScreen(): Promise<Socket> {
    const socket = io(`${baseUrl}/ws`, {
      transports: ['websocket'],
      auth: { role: 'screen' },
    })
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve())
      socket.on('connect_error', (err) => reject(err))
    })
    return socket
  }

  const nextEvent = (socket: Socket, event: string): Promise<Record<string, unknown>> =>
    new Promise((resolve) => {
      socket.once(event, (payload) => resolve(payload as Record<string, unknown>))
    })

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.useWebSocketAdapter(new IoAdapter(app))
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    )
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.listen(0)

    const address = app.getHttpServer().address()
    const port = typeof address === 'object' && address ? address.port : 0
    baseUrl = `http://127.0.0.1:${port}`

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

  it('guards writes and creates an institution with normalized province', async () => {
    await request(app.getHttpServer()).post('/api/institutions').send(basePayload).expect(401)

    await request(app.getHttpServer())
      .post('/api/institutions')
      .set(auth(viewerToken))
      .send(basePayload)
      .expect(403)

    const res = await request(app.getHttpServer())
      .post('/api/institutions')
      .set(auth(adminToken))
      .send(basePayload)
      .expect(201)

    inst1 = res.body as Institution
    expect(inst1).toMatchObject({
      province: '测试',
      city: '测试市',
      nameZh: `${INST_PREFIX}A`,
      hasWard: true,
      hasClinic: false,
      typeTags: ['ward'],
      longitude: 120.1,
      latitude: 30.2,
      isLit: false,
    })
    expect(inst1.wardProjects).toEqual(['项目 A'])

    const duplicate = await request(app.getHttpServer())
      .post('/api/institutions')
      .set(auth(superToken))
      .send(basePayload)
      .expect(409)
    expect(duplicate.body.message).toBe('该省份/城市下已存在同名机构')

    await request(app.getHttpServer())
      .post('/api/institutions')
      .set(auth(superToken))
      .send({ ...basePayload, nameZh: `${INST_PREFIX}BAD-MISSING`, longitude: undefined })
      .expect(400)

    await request(app.getHttpServer())
      .post('/api/institutions')
      .set(auth(superToken))
      .send({ ...basePayload, nameZh: `${INST_PREFIX}BAD-LAT`, latitude: 100 })
      .expect(400)
  })

  it('updates institution fields, derives typeTags, and rejects duplicates', async () => {
    const second = await request(app.getHttpServer())
      .post('/api/institutions')
      .set(auth(superToken))
      .send({ ...basePayload, nameZh: `${INST_PREFIX}B`, hasWard: false })
      .expect(201)
    inst2 = second.body as Institution

    const updated = await request(app.getHttpServer())
      .patch(`/api/institutions/${inst1.id}`)
      .set(auth(superToken))
      .send({
        hasClinic: true,
        nameEn: 'Test Hospital',
        description: '更新后的简介',
        address: '更新后的地址',
      })
      .expect(200)

    expect(updated.body).toMatchObject({
      id: inst1.id,
      hasWard: true,
      hasClinic: true,
      typeTags: ['ward', 'clinic'],
      nameEn: 'Test Hospital',
      description: '更新后的简介',
      address: '更新后的地址',
    })

    await request(app.getHttpServer())
      .patch(`/api/institutions/${inst1.id}`)
      .set(auth(superToken))
      .send({ nameZh: inst2.nameZh })
      .expect(409)

    await request(app.getHttpServer())
      .patch('/api/institutions/999999')
      .set(auth(superToken))
      .send({ address: 'x' })
      .expect(404)
  })

  it('lights and revokes an institution with matching WebSocket events', async () => {
    const socket = await connectScreen()

    const checkinPromise = nextEvent(socket, 'checkin')
    const on = await request(app.getHttpServer())
      .patch(`/api/institutions/${inst1.id}/lit`)
      .set(auth(superToken))
      .send({ isLit: true })
      .expect(200)

    expect(on.body).toMatchObject({
      success: true,
      institutionId: inst1.id,
      isLit: true,
    })
    expect(typeof on.body.litAt).toBe('string')

    const checkinPayload = await checkinPromise
    expect(checkinPayload).toMatchObject({
      success: true,
      alreadyLit: false,
      institutionId: inst1.id,
      province: '测试',
      nameZh: inst1.nameZh,
    })

    const lit = await prisma.institution.findUniqueOrThrow({ where: { id: inst1.id } })
    expect(lit.isLit).toBe(true)
    expect(lit.litAt).toBeInstanceOf(Date)

    const revokedPromise = nextEvent(socket, 'checkinRevoked')
    const off = await request(app.getHttpServer())
      .patch(`/api/institutions/${inst1.id}/lit`)
      .set(auth(superToken))
      .send({ isLit: false })
      .expect(200)

    expect(off.body).toMatchObject({
      success: true,
      institutionId: inst1.id,
      isLit: false,
      litAt: null,
    })
    await expect(revokedPromise).resolves.toEqual({
      institutionId: inst1.id,
      province: '测试',
    })

    const unlit = await prisma.institution.findUniqueOrThrow({ where: { id: inst1.id } })
    expect(unlit.isLit).toBe(false)
    expect(unlit.litAt).toBeNull()

    socket.close()
  })

  it('deletes institutions and revokes the glow of a lit institution', async () => {
    await request(app.getHttpServer())
      .patch(`/api/institutions/${inst1.id}/lit`)
      .set(auth(superToken))
      .send({ isLit: true })
      .expect(200)

    const socket = await connectScreen()
    const revokedPromise = nextEvent(socket, 'checkinRevoked')

    await request(app.getHttpServer())
      .delete(`/api/institutions/${inst1.id}`)
      .set(auth(superToken))
      .expect(200)
    await expect(revokedPromise).resolves.toEqual({
      institutionId: inst1.id,
      province: '测试',
    })
    expect(await prisma.institution.findUnique({ where: { id: inst1.id } })).toBeNull()

    await request(app.getHttpServer())
      .delete(`/api/institutions/${inst1.id}`)
      .set(auth(superToken))
      .expect(404)

    await request(app.getHttpServer())
      .delete(`/api/institutions/${inst2.id}`)
      .set(auth(superToken))
      .expect(200)
    expect(await prisma.institution.findUnique({ where: { id: inst2.id } })).toBeNull()

    socket.close()
  })
})