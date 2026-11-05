import { INestApplication, ValidationPipe } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { Test } from '@nestjs/testing'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { WordcloudScheduler } from '../src/wordcloud/wordcloud.scheduler'

const QUESTION_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']

describe('wordcloud endpoints (e2e)', () => {
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

  it('GET /api/wordcloud 固定返回八个问题的 key', async () => {
    const res = await request(app.getHttpServer()).get('/api/wordcloud').expect(200)

    expect(Object.keys(res.body).sort()).toEqual(QUESTION_KEYS)
    for (const key of QUESTION_KEYS) {
      expect(Array.isArray(res.body[key])).toBe(true)
    }
  })

  it('GET /api/wordcloud/:questionId 返回 [{ word, count }]', async () => {
    const res = await request(app.getHttpServer()).get('/api/wordcloud/q1').expect(200)

    expect(Array.isArray(res.body)).toBe(true)
    for (const item of res.body) {
      expect(typeof item.word).toBe('string')
      expect(typeof item.count).toBe('number')
    }
  })

  it('GET /api/wordcloud/:questionId/count 返回裸数字', async () => {
    const res = await request(app.getHttpServer()).get('/api/wordcloud/q1/count').expect(200)

    expect(typeof res.body).toBe('number')
    expect(res.body).toBeGreaterThanOrEqual(0)
  })

  it('未知题目 id 返回 400', async () => {
    await request(app.getHttpServer()).get('/api/wordcloud/q9').expect(400)
    await request(app.getHttpServer()).get('/api/wordcloud/q9/count').expect(400)
  })

  it('@Interval(5000) 已随 ScheduleModule 注册', () => {
    const intervals = app.get(SchedulerRegistry).getIntervals()
    expect(intervals.length).toBeGreaterThan(0)
  })

  it('答题落库后经调度器 flush 即可在词云里看到归一目标词', async () => {
    const scheduler = app.get(WordcloudScheduler)

    await request(app.getHttpServer())
      .post('/api/answer')
      .send({ questionId: 'q5', identityTag: 'nurse', answer: '安宁疗护与居家照护' })
      .expect(201)

    // 不等 5 秒：直接消费脏集合
    await scheduler.flush()

    const cloud = await request(app.getHttpServer()).get('/api/wordcloud/q5').expect(200)
    expect(cloud.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ word: '舒缓疗护' }),
        expect.objectContaining({ word: '居家照护' }),
      ]),
    )

    const count = await request(app.getHttpServer()).get('/api/wordcloud/q5/count').expect(200)
    expect(count.body).toBeGreaterThanOrEqual(1)
  })
})
