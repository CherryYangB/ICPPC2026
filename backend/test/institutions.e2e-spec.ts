import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'

describe('GET /api/institutions (e2e)', () => {
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

  it('returns a paginated list with meta', async () => {
    const res = await request(app.getHttpServer()).get('/api/institutions').expect(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20 })
    expect(res.body.meta.total).toBeGreaterThan(0)
    expect(res.body.data[0]).toHaveProperty('serviceTags')
    expect(res.body.data[0]).toHaveProperty('typeZh')
  })

  it('filters by type', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/institutions?type=hospital')
      .expect(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data.every((i: { type: string }) => i.type === 'hospital')).toBe(true)
  })

  it('filters by service tag', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/institutions?tags=' + encodeURIComponent('临床支持'))
      .expect(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(
      res.body.data.every((i: { serviceTags: Array<{ nameZh: string }> }) =>
        i.serviceTags.some((t) => t.nameZh === '临床支持'),
      ),
    ).toBe(true)
  })

  it('filters by keyword', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/institutions?keyword=' + encodeURIComponent('协和'))
      .expect(200)
    expect(res.body.data.length).toBeGreaterThan(0)
  })
})