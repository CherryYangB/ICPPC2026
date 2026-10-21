import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

describe('POST /api/answer (e2e)', () => {
  let app: INestApplication

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
  })

  afterAll(async () => {
    await app.close()
  })

  it('submits a valid answer', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/answer')
      .send({ questionId: 'q1', identityTag: 'physician', answer: '测试观点' })
      .expect(201)

    expect(res.body.success).toBe(true)
    expect(res.body).toHaveProperty('completed')
    expect(res.body).toHaveProperty('nextQuestionId')
  })

  it('rejects an unknown question id', async () => {
    await request(app.getHttpServer())
      .post('/api/answer')
      .send({ questionId: 'q9', identityTag: 'physician', answer: 'x' })
      .expect(400)
  })

  it('rejects an invalid identity tag', async () => {
    await request(app.getHttpServer())
      .post('/api/answer')
      .send({ questionId: 'q1', identityTag: 'hacker', answer: 'x' })
      .expect(400)
  })

  it('rejects an overlong answer', async () => {
    await request(app.getHttpServer())
      .post('/api/answer')
      .send({ questionId: 'q1', identityTag: 'physician', answer: 'a'.repeat(101) })
      .expect(400)
  })

  it('returns 404 when the question is inactive', async () => {
    const prisma = app.get(PrismaService)
    await prisma.question.update({ where: { id: 'q8' }, data: { isActive: false } })
    try {
      await request(app.getHttpServer())
        .post('/api/answer')
        .send({ questionId: 'q8', identityTag: 'parent', answer: 'x' })
        .expect(404)
    } finally {
      await prisma.question.update({ where: { id: 'q8' }, data: { isActive: true } })
    }
  })

  it('enforces cooldown on rapid duplicate submission', async () => {
    const payload = { questionId: 'q2', identityTag: 'nurse', answer: '冷却测试' }

    await request(app.getHttpServer()).post('/api/answer').send(payload).expect(201)

    const res = await request(app.getHttpServer()).post('/api/answer').send(payload).expect(429)
    expect(res.body.error).toBe('Too Many Requests')
    expect(res.headers['retry-after']).toBeDefined()
  })
})