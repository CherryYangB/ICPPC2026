import { INestApplication, ValidationPipe } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { Test } from '@nestjs/testing'
import type { Answer, User } from '@prisma/client'
import { hash } from 'bcrypt'
import { io, type Socket } from 'socket.io-client'
import request = require('supertest')
import { AppModule } from '../src/app.module'
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter'
import { PrismaService } from '../src/prisma/prisma.service'

const PREFIX = 'e2e_admin_answer_'
const USER_PREFIX = 'e2e_admin_answer_user_'
const PASSWORD = 'Password123'

describe('admin answers (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let baseUrl: string
  let superToken: string
  let adminToken: string
  let viewerToken: string
  let a1: Answer
  let a2: Answer
  let a3: Answer
  let a4: Answer
  let a5: Answer

  function login(username: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
  }

  async function cleanup(): Promise<void> {
    await prisma.answer.deleteMany({ where: { answer: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { username: { startsWith: USER_PREFIX } } })
  }

  async function createAnswer(
    questionId: string,
    identityTag: string,
    answer: string,
    isHidden = false,
  ): Promise<Answer> {
    return prisma.answer.create({
      data: { questionId, identityTag, answer: `${PREFIX}${answer}`, isHidden },
    })
  }

  async function createUser(username: string, role: string): Promise<User> {
    return prisma.user.create({
      data: {
        username: `${USER_PREFIX}${username}`,
        passwordHash: await hash(PASSWORD, 10),
        displayName: username,
        role,
        mustChangePassword: false,
      },
    })
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

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

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

  async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
    const startedAt = Date.now()
    while (!predicate()) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('timeout waiting for condition')
      }
      await sleep(20)
    }
  }

  async function wordCount(questionId: string, word: string): Promise<number> {
    const res = await request(app.getHttpServer())
      .get(`/api/wordcloud/${questionId}`)
      .expect(200)
    const item = (res.body as Array<{ word: string; count: number }>).find(
      (entry) => entry.word === word,
    )
    return item?.count ?? 0
  }

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

    const adminUser = await createUser('admin', 'admin')
    adminToken = (await login(adminUser.username, PASSWORD).expect(200)).body.token as string

    const viewerUser = await createUser('viewer', 'viewer')
    viewerToken = (await login(viewerUser.username, PASSWORD).expect(200)).body.token as string

    a1 = await createAnswer('q1', 'physician', 'alpha 培训')
    a2 = await createAnswer('q1', 'nurse', 'beta 培训')
    a3 = await createAnswer('q2', 'nurse', 'gamma', true)
    a4 = await createAnswer('q4', 'parent', '安宁疗护')
    a5 = await createAnswer('q4', 'parent', '安宁疗护')
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('requires auth, allows viewer to read, and restricts writes to admin/super_admin', async () => {
    await request(app.getHttpServer()).get('/api/admin/answers').expect(401)

    await request(app.getHttpServer())
      .get('/api/admin/answers')
      .set(auth(viewerToken))
      .expect(200)

    await request(app.getHttpServer())
      .patch(`/api/admin/answers/${a1.id}`)
      .send({ answer: 'unauthorized' })
      .expect(401)

    await request(app.getHttpServer())
      .patch(`/api/admin/answers/${a1.id}`)
      .set(auth(viewerToken))
      .send({ answer: 'forbidden' })
      .expect(403)

    const adminUpdate = await request(app.getHttpServer())
      .patch(`/api/admin/answers/${a1.id}`)
      .set(auth(adminToken))
      .send({ answer: `${PREFIX}alpha admin-updated` })
      .expect(200)
    expect(adminUpdate.body.answer).toBe(`${PREFIX}alpha admin-updated`)
  })

  it('lists and filters answers with pagination and safe fields', async () => {
    const all = await request(app.getHttpServer())
      .get(`/api/admin/answers?keyword=${PREFIX}`)
      .set(auth(superToken))
      .expect(200)

    expect(all.body.total).toBe(5)
    expect(all.body.items).toHaveLength(5)
    expect(Object.keys(all.body.items[0]).sort()).toEqual([
      'answer',
      'createdAt',
      'id',
      'identityTag',
      'isHidden',
      'questionId',
    ])
    expect(all.body.items[0]).not.toHaveProperty('clientIp')
    expect(typeof all.body.items[0].createdAt).toBe('string')

    const byQuestion = await request(app.getHttpServer())
      .get(`/api/admin/answers?questionId=q1&keyword=${PREFIX}`)
      .set(auth(superToken))
      .expect(200)
    expect(byQuestion.body.total).toBe(2)

    const byIdentity = await request(app.getHttpServer())
      .get(`/api/admin/answers?identityTag=nurse&keyword=${PREFIX}`)
      .set(auth(superToken))
      .expect(200)
    expect(byIdentity.body.total).toBe(2)

    const hidden = await request(app.getHttpServer())
      .get(`/api/admin/answers?isHidden=true&keyword=${PREFIX}`)
      .set(auth(superToken))
      .expect(200)
    expect(hidden.body.total).toBe(1)
    expect(hidden.body.items[0].id).toBe(a3.id)

    const paged = await request(app.getHttpServer())
      .get(`/api/admin/answers?keyword=${PREFIX}&page=1&pageSize=2`)
      .set(auth(superToken))
      .expect(200)
    expect(paged.body.items).toHaveLength(2)
    expect(paged.body.totalPages).toBe(3)

    await request(app.getHttpServer())
      .get(`/api/admin/answers?pageSize=101`)
      .set(auth(superToken))
      .expect(400)
  })

  it('updates answer content and validates input', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/answers/${a1.id}`)
      .set(auth(superToken))
      .send({ answer: `${PREFIX}alpha updated` })
      .expect(200)
    expect(res.body.answer).toBe(`${PREFIX}alpha updated`)

    await request(app.getHttpServer())
      .patch(`/api/admin/answers/${a1.id}`)
      .set(auth(superToken))
      .send({ answer: 'a'.repeat(101) })
      .expect(400)

    await request(app.getHttpServer())
      .patch('/api/admin/answers/not-exist')
      .set(auth(superToken))
      .send({ answer: 'x' })
      .expect(404)
  })

  it('hides an answer, broadcasts answerHidden, and excludes it from wordcloud/recent', async () => {
    const baseline = await wordCount('q4', '舒缓疗护')
    const socket = await connectScreen()
    const eventPromise = nextEvent(socket, 'answerHidden')

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/answers/${a5.id}/visibility`)
      .set(auth(superToken))
      .send({ isHidden: true })
      .expect(200)
    expect(res.body.isHidden).toBe(true)

    await expect(eventPromise).resolves.toEqual({ answerId: a5.id })
    expect(await wordCount('q4', '舒缓疗护')).toBe(baseline - 1)

    const recent = await request(app.getHttpServer())
      .get('/api/answer/recent?limit=50')
      .expect(200)
    expect(recent.body.some((item: { answerId: string }) => item.answerId === a5.id)).toBe(false)
    expect(
      recent.body.every(
        (item: Record<string, unknown>) =>
          typeof item.answerId === 'string' && !('clientIp' in item),
      ),
    ).toBe(true)

    let extraHiddenEvents = 0
    socket.on('answerHidden', () => {
      extraHiddenEvents += 1
    })
    await request(app.getHttpServer())
      .patch(`/api/admin/answers/${a5.id}/visibility`)
      .set(auth(superToken))
      .send({ isHidden: false })
      .expect(200)
    await sleep(300)
    expect(extraHiddenEvents).toBe(0)
    expect(await wordCount('q4', '舒缓疗护')).toBe(baseline)

    socket.close()
  })

  it('deletes an answer and broadcasts answerDeleted', async () => {
    const socket = await connectScreen()
    const eventPromise = nextEvent(socket, 'answerDeleted')

    await request(app.getHttpServer())
      .delete(`/api/admin/answers/${a3.id}`)
      .set(auth(superToken))
      .expect(200)

    await expect(eventPromise).resolves.toEqual({ answerId: a3.id })
    expect(await prisma.answer.findUnique({ where: { id: a3.id } })).toBeNull()

    await request(app.getHttpServer())
      .delete(`/api/admin/answers/${a3.id}`)
      .set(auth(superToken))
      .expect(404)

    socket.close()
  })

  it('batch hides answers and broadcasts one event per answer', async () => {
    const socket = await connectScreen()
    const hiddenIds: string[] = []
    socket.on('answerHidden', (payload: { answerId: string }) => {
      hiddenIds.push(payload.answerId)
    })

    const res = await request(app.getHttpServer())
      .post('/api/admin/answers/batch-hide')
      .set(auth(superToken))
      .send({ ids: [a2.id, a4.id, a2.id, 'not-exist'] })
      .expect(200)

    expect(res.body).toEqual({ updated: 2 })
    await waitUntil(() => hiddenIds.length === 2)
    expect(hiddenIds.sort()).toEqual([a2.id, a4.id].sort())

    const hidden = await request(app.getHttpServer())
      .get(`/api/admin/answers?isHidden=true&keyword=${PREFIX}`)
      .set(auth(superToken))
      .expect(200)
    expect(hidden.body.total).toBe(2)

    const again = await request(app.getHttpServer())
      .post('/api/admin/answers/batch-hide')
      .set(auth(superToken))
      .send({ ids: [a2.id] })
      .expect(200)
    expect(again.body).toEqual({ updated: 0 })

    socket.close()
  })

  it('batch deletes answers and validates ids as cuid strings', async () => {
    const b1 = await createAnswer('q6', 'volunteer', 'batch one')
    const b2 = await createAnswer('q6', 'volunteer', 'batch two')

    const socket = await connectScreen()
    const deletedIds: string[] = []
    socket.on('answerDeleted', (payload: { answerId: string }) => {
      deletedIds.push(payload.answerId)
    })

    const res = await request(app.getHttpServer())
      .post('/api/admin/answers/batch-delete')
      .set(auth(superToken))
      .send({ ids: [b1.id, b2.id, 'not-exist'] })
      .expect(200)

    expect(res.body).toEqual({ deleted: 2 })
    await waitUntil(() => deletedIds.length === 2)
    expect(deletedIds.sort()).toEqual([b1.id, b2.id].sort())
    expect(await prisma.answer.count({ where: { id: { in: [b1.id, b2.id] } } })).toBe(0)

    await request(app.getHttpServer())
      .post('/api/admin/answers/batch-delete')
      .set(auth(superToken))
      .send({ ids: [1, 2] })
      .expect(400)

    const empty = await request(app.getHttpServer())
      .post('/api/admin/answers/batch-delete')
      .set(auth(superToken))
      .send({ ids: ['not-exist'] })
      .expect(200)
    expect(empty.body).toEqual({ deleted: 0 })

    socket.close()
  })
})
