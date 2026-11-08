import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { hash } from 'bcrypt'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

const PREFIX = 'e2e_dashboard_'
const INST_PREFIX = 'e2e_dashboard_inst_'
const USER_PREFIX = 'e2e_dashboard_user_'
const PASSWORD = 'Password123'
const UNIQUE_IP = '198.51.100.77'

describe('admin dashboard (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let superToken: string
  let viewerToken: string

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

  function login(username: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
  }

  async function cleanup(): Promise<void> {
    await prisma.answer.deleteMany({ where: { answer: { startsWith: PREFIX } } })
    await prisma.institution.deleteMany({ where: { nameZh: { startsWith: INST_PREFIX } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: USER_PREFIX } } })
  }

  function dashboard(token: string) {
    return request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .set(auth(token))
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

    await prisma.user.create({
      data: {
        username: `${USER_PREFIX}viewer`,
        passwordHash: await hash(PASSWORD, 10),
        displayName: '总览测试 viewer',
        role: 'viewer',
        mustChangePassword: false,
      },
    })
    viewerToken = (await login(`${USER_PREFIX}viewer`, PASSWORD).expect(200)).body.token as string
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('requires auth and allows viewer to read', async () => {
    await request(app.getHttpServer()).get('/api/admin/dashboard').expect(401)

    const res = await dashboard(viewerToken).expect(200)
    expect(res.body).toHaveProperty('totalAnswers')
    expect(res.body).toHaveProperty('recentActivity')
  })

  it('returns overview statistics, merged recent activity, and hidden filtering', async () => {
    const baseline = (await dashboard(superToken).expect(200)).body as {
      totalAnswers: number
      todayAnswers: number
      onlineCount: number
      litInstitutions: number
      totalInstitutions: number
      answersByQuestion: Array<{ questionId: string; count: number }>
    }
    const baselineQ3 = baseline.answersByQuestion.find((item) => item.questionId === 'q3')?.count ?? 0

    const longAnswer = `${PREFIX}${'长'.repeat(80)}`
    const visible = await prisma.answer.create({
      data: {
        questionId: 'q3',
        identityTag: 'physician',
        answer: longAnswer,
        clientIp: UNIQUE_IP,
      },
    })
    await prisma.answer.create({
      data: {
        questionId: 'q3',
        identityTag: 'nurse',
        answer: `${PREFIX}hidden`,
        clientIp: '198.51.100.78',
        isHidden: true,
      },
    })

    const institution = await prisma.institution.create({
      data: {
        province: '测试',
        city: '测试市',
        nameZh: INST_PREFIX,
        longitude: 120,
        latitude: 30,
      },
    })
    await request(app.getHttpServer())
      .patch(`/api/institutions/${institution.id}/lit`)
      .set(auth(superToken))
      .send({ isLit: true })
      .expect(200)

    const after = (await dashboard(superToken).expect(200)).body as {
      totalAnswers: number
      todayAnswers: number
      onlineCount: number
      litInstitutions: number
      totalInstitutions: number
      litProvinces: number
      answersByQuestion: Array<{ questionId: string; topicZh: string; color: string; count: number }>
      recentActivity: Array<Record<string, unknown>>
    }

    expect(after.totalAnswers).toBe(baseline.totalAnswers + 1)
    expect(after.todayAnswers).toBe(baseline.todayAnswers + 1)
    expect(after.onlineCount).toBeGreaterThanOrEqual(baseline.onlineCount + 1)
    expect(after.totalInstitutions).toBe(baseline.totalInstitutions + 1)
    expect(after.litInstitutions).toBe(baseline.litInstitutions + 1)

    expect(after.answersByQuestion).toHaveLength(8)
    expect(after.answersByQuestion.map((item) => item.questionId)).toEqual([
      'q1',
      'q2',
      'q3',
      'q4',
      'q5',
      'q6',
      'q7',
      'q8',
    ])
    const q3 = after.answersByQuestion.find((item) => item.questionId === 'q3')
    expect(q3?.count).toBe(baselineQ3 + 1)
    expect(q3?.topicZh).toBe('医师培训')
    expect(q3?.color).toBe('#9b51e0')

    expect(after.recentActivity.length).toBeLessThanOrEqual(20)
    const answerActivity = after.recentActivity.find(
      (item) => item.type === 'answer' && String(item.preview).startsWith(PREFIX),
    )
    expect(answerActivity).toBeDefined()
    expect(answerActivity?.questionId).toBe('q3')
    expect(answerActivity?.identityTag).toBe('physician')
    expect(String(answerActivity?.preview).endsWith('…')).toBe(true)
    expect(Array.from(String(answerActivity?.preview))).toHaveLength(61)

    const checkinActivity = after.recentActivity.find(
      (item) => item.type === 'checkin' && item.nameZh === INST_PREFIX,
    )
    expect(checkinActivity).toBeDefined()
    expect(checkinActivity?.province).toBe('测试')

    expect(
      after.recentActivity.some(
        (item) => item.type === 'answer' && String(item.preview).includes('hidden'),
      ),
    ).toBe(false)

    const timestamps = after.recentActivity.map((item) => String(item.createdAt))
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a))
    expect(timestamps).toEqual(sorted)

    expect(visible.id).toBeTruthy()
  })
})
