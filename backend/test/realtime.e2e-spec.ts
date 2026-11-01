import { INestApplication, ValidationPipe } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { Test } from '@nestjs/testing'
import { io } from 'socket.io-client'
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

describe('WebSocket newAnswer (e2e)', () => {
  let app: INestApplication
  let baseUrl: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.useWebSocketAdapter(new IoAdapter(app))
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.listen(0)

    const address = app.getHttpServer().address()
    const port = typeof address === 'object' && address ? address.port : 0
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    await app.close()
  })

  it('broadcasts newAnswer to a screen client', async () => {
    const socket = io(`${baseUrl}/ws`, {
      transports: ['websocket'],
      auth: { role: 'screen' },
    })

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve())
      socket.on('connect_error', (err) => reject(err))
    })

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      socket.on('newAnswer', (payload) => resolve(payload as Record<string, unknown>))
    })

    const res = await fetch(`${baseUrl}/api/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'q3', identityTag: 'nurse', answer: '实时测试' }),
    })
    expect(res.status).toBe(201)

    const payload = await eventPromise
    expect(payload).toMatchObject({
      questionId: 'q3',
      identityTag: 'nurse',
      answer: '实时测试',
    })
    expect(payload).not.toHaveProperty('clientIp')
    expect(payload).toHaveProperty('identityTagZh')
    expect(payload).toHaveProperty('identityTagEn')

    socket.close()
  })

  it('broadcasts checkin to a screen client', async () => {
    const prisma = app.get(PrismaService)
    // 固定用云南（institutions 用例只点亮广东），避免并行/顺序依赖造成的抖动
    const target = await prisma.institution.findFirst({
      where: { province: '云南' },
      orderBy: { id: 'asc' },
    })
    expect(target).not.toBeNull()
    await prisma.institution.update({
      where: { id: target!.id },
      data: { isLit: false, litAt: null },
    })

    const socket = io(`${baseUrl}/ws`, {
      transports: ['websocket'],
      auth: { role: 'screen' },
    })
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve())
      socket.on('connect_error', (err) => reject(err))
    })

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      socket.on('checkin', (payload) => resolve(payload as Record<string, unknown>))
    })

    const res = await fetch(`${baseUrl}/api/institutions/${target!.id}/checkin`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ alreadyLit: false, institutionId: target!.id })

    const payload = await eventPromise
    expect(payload).toMatchObject({
      institutionId: target!.id,
      province: '云南',
      litInstitutions: expect.any(Number),
      litProvinces: expect.any(Number),
    })
    expect(payload).toHaveProperty('city')
    expect(payload).toHaveProperty('nameZh')

    socket.close()
    await prisma.institution.update({
      where: { id: target!.id },
      data: { isLit: false, litAt: null },
    })
  })
})