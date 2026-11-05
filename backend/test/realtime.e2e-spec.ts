import { INestApplication, ValidationPipe } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { Test } from '@nestjs/testing'
import { io, type Socket } from 'socket.io-client'
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'
import { WordcloudScheduler } from '../src/wordcloud/wordcloud.scheduler'

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

  /** 连接 /ws 命名空间并等待握手完成（大屏身份才会被加入 screens 房间） */
  const connectScreen = async (): Promise<Socket> => {
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

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

  const waitUntil = async (predicate: () => boolean, timeoutMs = 3000): Promise<void> => {
    const startedAt = Date.now()
    while (!predicate()) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('timeout waiting for condition')
      }
      await sleep(20)
    }
  }

  it('broadcasts newAnswer to a screen client', async () => {
    const socket = await connectScreen()
    const eventPromise = nextEvent(socket, 'newAnswer')

    const res = await fetch(`${baseUrl}/api/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'q3', identityTag: 'nurse', answer: '实时测试' }),
    })
    expect(res.status).toBe(201)

    const payload = await eventPromise
    // 弹幕最小字段集：与 backend NewAnswerEvent 完全一致
    expect(Object.keys(payload).sort()).toEqual(['answer', 'identityTag', 'questionId', 'timestamp'])
    expect(payload).toMatchObject({
      questionId: 'q3',
      identityTag: 'nurse',
      answer: '实时测试',
    })
    expect(typeof payload.timestamp).toBe('string')
    expect(payload).not.toHaveProperty('clientIp')

    socket.close()
  })

  it('broadcasts wordCloudUpdate after the scheduler flush', async () => {
    const scheduler = app.get(WordcloudScheduler)
    const socket = await connectScreen()

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      socket.on('wordCloudUpdate', (payload: Record<string, unknown>) => {
        // 后台 @Interval 可能先广播其它问题，只关心本次的 q4
        if (payload.questionId === 'q4') resolve(payload)
      })
    })

    const res = await fetch(`${baseUrl}/api/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'q4', identityTag: 'nurse', answer: '安宁疗护与居家照护' }),
    })
    expect(res.status).toBe(201)

    // 不等 5 秒：直接让调度器消费脏集合
    await scheduler.flush()

    const payload = await eventPromise
    expect(Object.keys(payload).sort()).toEqual(['questionId', 'timestamp', 'words'])
    expect(payload.questionId).toBe('q4')
    expect(typeof payload.timestamp).toBe('string')
    expect(payload.words).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ word: '舒缓疗护' }),
        expect.objectContaining({ word: '居家照护' }),
      ]),
    )

    socket.close()
  })

  it('broadcasts checkin with the same payload as the REST response', async () => {
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

    const socket = await connectScreen()
    const eventPromise = nextEvent(socket, 'checkin')

    const res = await fetch(`${baseUrl}/api/institutions/${target!.id}/checkin`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({ success: true, alreadyLit: false, institutionId: target!.id })

    const payload = await eventPromise
    // 广播负载与接口返回逐字段一致（WS 不携带 litAt）
    expect(payload).toEqual({
      success: body.success,
      alreadyLit: body.alreadyLit,
      institutionId: body.institutionId,
      nameZh: body.nameZh,
      province: body.province,
      city: body.city,
      litInstitutions: body.litInstitutions,
      litProvinces: body.litProvinces,
      litCities: body.litCities,
    })
    expect(Object.keys(payload).sort()).toEqual([
      'alreadyLit',
      'city',
      'institutionId',
      'litCities',
      'litInstitutions',
      'litProvinces',
      'nameZh',
      'province',
      'success',
    ])
    expect(payload).not.toHaveProperty('litAt')

    socket.close()
    await prisma.institution.update({
      where: { id: target!.id },
      data: { isLit: false, litAt: null },
    })
  })

  it('does not broadcast checkin for an already lit institution', async () => {
    const prisma = app.get(PrismaService)
    const target = await prisma.institution.findFirst({
      where: { province: '江西' },
      orderBy: { id: 'asc' },
    })
    expect(target).not.toBeNull()
    const id = target!.id
    await prisma.institution.update({ where: { id }, data: { isLit: false, litAt: null } })

    const socket = await connectScreen()
    let received: Record<string, unknown> | null = null
    socket.on('checkin', (payload) => {
      received = payload as Record<string, unknown>
    })

    // 首次点亮：应收到广播
    const first = await fetch(`${baseUrl}/api/institutions/${id}/checkin`, { method: 'POST' })
    expect(first.status).toBe(200)
    await waitUntil(() => received !== null)
    expect(received).toMatchObject({ alreadyLit: false, institutionId: id })

    // 重复打卡：alreadyLit=true，且不得再广播（避免多屏重复触发发光动画）
    received = null
    const second = await fetch(`${baseUrl}/api/institutions/${id}/checkin`, { method: 'POST' })
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({
      success: true,
      alreadyLit: true,
      institutionId: id,
    })
    await sleep(1200)
    expect(received).toBeNull()

    socket.close()
    await prisma.institution.update({ where: { id }, data: { isLit: false, litAt: null } })
  })
})