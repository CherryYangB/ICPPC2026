import { INestApplication, ValidationPipe } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { Test } from '@nestjs/testing'
import { io } from 'socket.io-client'
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'

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
})