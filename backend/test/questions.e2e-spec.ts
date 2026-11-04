import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'

// H5 启动即调 GET /api/questions 并把结果映射成题目卡片（失败回退本地兜底），
// 这里锁住「8 条 + 按 order 升序 + 恰好 7 个字段 + 缓存头」的契约。
describe('GET /api/questions (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    )
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns the eight questions ordered by order, with cache headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/questions').expect(200)

    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(8)
    expect(res.body.map((row: { id: string }) => row.id)).toEqual([
      'q1',
      'q2',
      'q3',
      'q4',
      'q5',
      'q6',
      'q7',
      'q8',
    ])
    expect(res.body.map((row: { order: number }) => row.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    // 前端卡片映射依赖这 7 个字段：增删字段时请同步 H5 的 ApiQuestion / QuestionCard
    expect(Object.keys(res.body[0]).sort()).toEqual([
      'color',
      'id',
      'order',
      'titleEn',
      'titleZh',
      'topicEn',
      'topicZh',
    ])

    expect(String(res.headers['cache-control'])).toContain('max-age=300')
    expect(res.headers.etag).toBeTruthy()
  })
})
