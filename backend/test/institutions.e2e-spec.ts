import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

// 数量断言跟随 prisma/seed-data/institutions.json（72 家：病房 44 / 门诊 36 / 广东 12）
describe('GET /api/institutions (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

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
  })

  afterAll(async () => {
    await prisma.institution.updateMany({ data: { isLit: false } })
    await app.close()
  })

  it('returns every institution as a flat array with only the public fields', async () => {
    const res = await request(app.getHttpServer()).get('/api/institutions').expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(72)

    const first = res.body[0]
    expect(Object.keys(first).sort()).toEqual([
      'city',
      'clinicDepartments',
      'hasClinic',
      'hasWard',
      'id',
      'isLit',
      'latitude',
      'longitude',
      'nameEn',
      'nameZh',
      'province',
      'typeTags',
      'wardProjects',
    ])
    expect(typeof first.id).toBe('number')
    expect(typeof first.longitude).toBe('number')
    expect(Array.isArray(first.wardProjects)).toBe(true)
  })

  it('filters by type=ward / type=clinic', async () => {
    const ward = await request(app.getHttpServer()).get('/api/institutions?type=ward').expect(200)
    expect(ward.body.length).toBe(44)
    expect(ward.body.every((item) => item.hasWard)).toBe(true)

    const clinic = await request(app.getHttpServer())
      .get('/api/institutions?type=clinic')
      .expect(200)
    expect(clinic.body.length).toBe(36)
    expect(clinic.body.every((item) => item.hasClinic)).toBe(true)
  })

  it('filters by province and accepts the full GeoJSON name', async () => {
    const short = await request(app.getHttpServer())
      .get('/api/institutions?province=' + encodeURIComponent('广东'))
      .expect(200)
    expect(short.body.length).toBe(12)

    const full = await request(app.getHttpServer())
      .get('/api/institutions?province=' + encodeURIComponent('广东省'))
      .expect(200)
    expect(full.body.length).toBe(12)
    expect(full.body.every((item) => item.province === '广东')).toBe(true)
  })

  it('filters by keyword on nameZh / nameEn', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/institutions?keyword=' + encodeURIComponent('儿童医院'))
      .expect(200)
    expect(res.body.length).toBe(18)
  })

  it('combines type + province + keyword with AND', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/api/institutions?type=ward&province=' +
          encodeURIComponent('广东省') +
          '&keyword=' +
          encodeURIComponent('儿童'),
      )
      .expect(200)
    expect(res.body.length).toBeGreaterThan(0)
    const allMatch = res.body.every(
      (item) => item.hasWard && item.province === '广东' && item.nameZh.includes('儿童'),
    )
    expect(allMatch).toBe(true)
  })

  it('rejects an unknown type with 400', async () => {
    await request(app.getHttpServer()).get('/api/institutions?type=hospital').expect(400)
  })

  it('returns stats and the checked-in list', async () => {
    const before = await request(app.getHttpServer()).get('/api/institutions/stats').expect(200)
    expect(before.body).toEqual({
      totalInstitutions: 72,
      litInstitutions: 0,
      litProvinces: 0,
      litCities: 0,
    })

    await request(app.getHttpServer()).get('/api/institutions/checked-in').expect(200).expect([])

    await prisma.institution.updateMany({ where: { province: '广东' }, data: { isLit: true } })

    const after = await request(app.getHttpServer()).get('/api/institutions/stats').expect(200)
    expect(after.body.totalInstitutions).toBe(72)
    expect(after.body.litInstitutions).toBe(12)
    expect(after.body.litProvinces).toBe(1)
    expect(after.body.litCities).toBe(4)

    const checked = await request(app.getHttpServer())
      .get('/api/institutions/checked-in')
      .expect(200)
    expect(checked.body.length).toBe(12)
    expect(checked.body.every((item) => item.isLit)).toBe(true)
    expect(checked.body.every((item) => item.province === '广东')).toBe(true)

    await prisma.institution.updateMany({ data: { isLit: false } })
  })
})

describe('POST /api/institutions/:id/checkin (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

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
    await prisma.institution.updateMany({ data: { isLit: false } })
  })

  afterAll(async () => {
    await prisma.institution.updateMany({ data: { isLit: false } })
    await app.close()
  })

  it('lights an institution and reports the updated stats', async () => {
    const target = await prisma.institution.findFirst({
      where: { province: '广东' },
      orderBy: { id: 'asc' },
    })
    expect(target).not.toBeNull()
    const id = target!.id

    const res = await request(app.getHttpServer())
      .post(`/api/institutions/${id}/checkin`)
      .expect(200)
    expect(res.body).toMatchObject({
      alreadyLit: false,
      institutionId: id,
      litInstitutions: 1,
      litProvinces: 1,
    })
    expect(typeof res.body.litAt).toBe('string')

    const stored = await prisma.institution.findUnique({ where: { id } })
    expect(stored?.isLit).toBe(true)
    expect(stored?.litAt).toBeInstanceOf(Date)

    const stats = await request(app.getHttpServer()).get('/api/institutions/stats').expect(200)
    expect(stats.body.litInstitutions).toBe(1)
    expect(stats.body.litProvinces).toBe(1)

    const checked = await request(app.getHttpServer())
      .get('/api/institutions/checked-in')
      .expect(200)
    expect(checked.body).toHaveLength(1)
    expect(checked.body[0].id).toBe(id)
  })

  it('returns alreadyLit for an institution that is already lit', async () => {
    const target = await prisma.institution.findFirst({ where: { isLit: true } })
    const res = await request(app.getHttpServer())
      .post(`/api/institutions/${target!.id}/checkin`)
      .expect(200)
    expect(res.body).toEqual({ alreadyLit: true })
  })

  it('suppresses a second call inside the cooldown window even after isLit was reset', async () => {
    const target = await prisma.institution.findFirst({ where: { isLit: true } })
    const id = target!.id
    await prisma.institution.update({ where: { id }, data: { isLit: false, litAt: null } })

    const res = await request(app.getHttpServer())
      .post(`/api/institutions/${id}/checkin`)
      .expect(200)
    expect(res.body).toEqual({ alreadyLit: true })

    const stored = await prisma.institution.findUnique({ where: { id } })
    expect(stored?.isLit).toBe(false)
  })

  it('returns 404 for an unknown institution', async () => {
    await request(app.getHttpServer()).post('/api/institutions/999999/checkin').expect(404)
  })

  it('returns 400 for a non-numeric id', async () => {
    await request(app.getHttpServer()).post('/api/institutions/abc/checkin').expect(400)
  })
})