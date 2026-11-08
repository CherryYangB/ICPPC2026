import { PrismaService } from '../prisma/prisma.service'
import { WordcloudService, type WordCloudItem } from './wordcloud.service'

interface AnswerRow {
  questionId: string
  answer: string
}

const QUESTION_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']

function asMap(items: readonly WordCloudItem[]): Record<string, number> {
  return Object.fromEntries(items.map((item) => [item.word, item.count]))
}

/** 用内存数据伪造 PrismaService：单问题返回 { answer }，批量返回 { questionId, answer } */
function createService(rows: readonly AnswerRow[], totalCount = rows.length) {
  const prisma = {
    answer: {
      findMany: jest.fn(
        async (args: { where?: { questionId?: string | { in?: readonly string[] } } }) => {
          const filter = args.where?.questionId
          if (typeof filter === 'string') {
            return rows
              .filter((row) => row.questionId === filter)
              .map((row) => ({ answer: row.answer }))
          }
          return rows.map((row) => ({ questionId: row.questionId, answer: row.answer }))
        },
      ),
      count: jest.fn(async () => totalCount),
    },
  } as unknown as PrismaService

  const service = new WordcloudService(prisma)
  service.onModuleInit()
  return { service, prisma }
}

describe('WordcloudService（保护性分词 + 同义词归一）', () => {
  it('最长匹配优先：儿童舒缓疗护 不会被 舒缓疗护 抢走', async () => {
    const { service } = createService([{ questionId: 'q1', answer: '我认为儿童舒缓疗护最重要' }])

    await expect(service.computeWordCloud('q1')).resolves.toEqual([
      { word: '儿童舒缓疗护', count: 1 },
    ])
  })

  it('词条与英文写法都归一到同一个目标词，并按出现次数累计', async () => {
    const { service } = createService([
      { questionId: 'q1', answer: '安宁疗护和 palliative care 都很重要' },
      { questionId: 'q1', answer: 'hospice care 也需要' },
    ])

    expect(asMap(await service.computeWordCloud('q1'))).toEqual({ 舒缓疗护: 3 })
  })

  it('目标词自身没有自映射时也能统计（延续性照护 / 继续教育 / ECHO）', async () => {
    const { service } = createService([
      { questionId: 'q2', answer: '延续性照护、继续教育，还有 ECHO' },
    ])

    expect(asMap(await service.computeWordCloud('q2'))).toEqual({
      延续性照护: 1,
      继续教育: 1,
      ECHO: 1,
    })
  })

  it('英文大小写不敏感：MDT / mdt / 多学科团队 都归一为 MDT', async () => {
    const { service } = createService([
      { questionId: 'q3', answer: 'MDT 和 mdt 都要，多学科团队也要' },
    ])

    expect(asMap(await service.computeWordCloud('q3'))).toEqual({ MDT: 3 })
  })

  it('非词表词不进入词云', async () => {
    const { service } = createService([
      { questionId: 'q4', answer: '今天天气很好，我们开会讨论了问题。123' },
    ])

    await expect(service.computeWordCloud('q4')).resolves.toEqual([])
  })

  it('没有归一目标词的词条按原词条统计', async () => {
    const { service } = createService([
      { questionId: 'q7', answer: '安宁病房和日间照护都需要' },
    ])

    expect(asMap(await service.computeWordCloud('q7'))).toEqual({
      安宁病房: 1,
      日间照护: 1,
    })
  })

  it('没有归一目标词的英文写法归到中文词条', async () => {
    const { service } = createService([
      { questionId: 'q7', answer: 'hospice ward 与 pain management 都要重视' },
    ])

    expect(asMap(await service.computeWordCloud('q7'))).toEqual({
      安宁病房: 1,
      疼痛管理: 1,
    })
  })

  it('按 count 降序返回，同 count 保持首次出现顺序', async () => {
    const { service } = createService([
      { questionId: 'q5', answer: '安宁疗护 安宁疗护' },
      { questionId: 'q5', answer: '多学科团队' },
      { questionId: 'q5', answer: '居家照护' },
    ])

    await expect(service.computeWordCloud('q5')).resolves.toEqual([
      { word: '舒缓疗护', count: 2 },
      { word: 'MDT', count: 1 },
      { word: '居家照护', count: 1 },
    ])
  })

  it('computeAllWordClouds 固定返回 q1..q8 八个 key', async () => {
    const { service } = createService([{ questionId: 'q2', answer: '居家护理' }])

    const clouds = await service.computeAllWordClouds()

    expect(Object.keys(clouds).sort()).toEqual(QUESTION_KEYS)
    expect(clouds.q2).toEqual([{ word: '居家照护', count: 1 }])
    expect(clouds.q1).toEqual([])
  })

  it('countAnswers 直接返回答题总数', async () => {
    const { service, prisma } = createService([{ questionId: 'q6', answer: '随便写点' }], 42)

    await expect(service.countAnswers('q6')).resolves.toBe(42)
    expect(prisma.answer.count).toHaveBeenCalledWith({
      where: { questionId: 'q6', isHidden: false },
    })
  })

  it('词典未加载时降级为空结果（不抛错）', async () => {
    const prisma = {
      answer: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
      },
    } as unknown as PrismaService

    const service = new WordcloudService(prisma) // 故意不调用 onModuleInit

    await expect(service.computeWordCloud('q1')).resolves.toEqual([])

    const clouds = await service.computeAllWordClouds()
    expect(Object.keys(clouds).sort()).toEqual(QUESTION_KEYS)
    expect(Object.values(clouds).every((items) => items.length === 0)).toBe(true)
  })
})
