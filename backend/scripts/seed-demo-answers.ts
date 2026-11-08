import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

/**
 * 写入演示答题数据（八问各 1~2 条），用于本地/演示环境查看词云与弹幕效果。
 *
 * 特点：
 * - 幂等：演示数据的 clientIp 统一用 TEST-NET-2 保留段（198.51.100.x，公网不可路由），
 *   每次执行前先按该前缀清理，再写入，重复运行不会累加。
 * - 参与人数会等于演示条数（每行一个独立 IP）。
 *
 * 运行：npm run seed:demo
 */
const DEMO_IP_PREFIX = '198.51.100.'

interface DemoAnswer {
  questionId: string
  identityTag: string
  answer: string
}

const DEMO_ANSWERS: readonly DemoAnswer[] = [
  {
    questionId: 'q1',
    identityTag: 'physician',
    answer: '我们需要统一的舒缓疗护临床标准，包括疼痛评估和症状管理，也要明确转诊标准。',
  },
  {
    questionId: 'q1',
    identityTag: 'nurse',
    answer: '安宁疗护应该早期介入，不能等到终末期才转诊，居家照护也需要标准。',
  },
  {
    questionId: 'q2',
    identityTag: 'physician',
    answer: '建议用 ECHO 模式做远程培训，建设全国人才培养体系，覆盖基层医生和护士。',
  },
  {
    questionId: 'q3',
    identityTag: 'parent',
    answer: '希望儿科医生学会坏消息告知和家庭沟通，多倾听儿童和家庭的声音。',
  },
  {
    questionId: 'q4',
    identityTag: 'social_worker',
    answer: '家庭支持体系要提供社工、心理支持和喘息服务，也需要经济援助。',
  },
  {
    questionId: 'q5',
    identityTag: 'psychologist',
    answer: '用游戏治疗帮助孩子表达意愿，让儿童的声音进入决策，家庭会议很重要。',
  },
  {
    questionId: 'q6',
    identityTag: 'nurse',
    answer: '居家照护团队要提供上门护理、疼痛管理和24小时电话支持，建立转诊网络。',
  },
  {
    questionId: 'q7',
    identityTag: 'physician',
    answer: '舒缓疗护工作情感消耗大，需要督导和心理支持，解决薪酬和职业发展才能留住人才。',
  },
  {
    questionId: 'q8',
    identityTag: 'administrator',
    answer: '成立区域儿童舒缓疗护联盟，制定转诊协议，从 MDT 走向行业协作。',
  },
  {
    questionId: 'q8',
    identityTag: 'social_worker',
    answer: '医院、社工机构和基金会要定期沟通，MDT 和行业协作能避免重复服务。',
  },
]

async function main(): Promise<void> {
  const prisma = new PrismaClient()

  try {
    const questionIds = [...new Set(DEMO_ANSWERS.map((item) => item.questionId))]
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true },
    })
    const found = new Set(questions.map((item) => item.id))
    const missing = questionIds.filter((id) => !found.has(id))
    if (missing.length > 0) {
      throw new Error(`题目未初始化：${missing.join(', ')}，请先执行 npm run prisma:seed`)
    }

    const removed = await prisma.answer.deleteMany({
      where: { clientIp: { startsWith: DEMO_IP_PREFIX } },
    })

    let index = 0
    for (const item of DEMO_ANSWERS) {
      index += 1
      await prisma.answer.create({
        data: {
          questionId: item.questionId,
          identityTag: item.identityTag,
          answer: item.answer,
          clientIp: `${DEMO_IP_PREFIX}${index}`,
        },
      })
    }

    const total = await prisma.answer.count()
    console.log(`清理旧演示数据 ${removed.count} 条，写入 ${DEMO_ANSWERS.length} 条`)
    console.log(`Answer 总数：${total}（参与人数按 clientIp 去重应为 ${DEMO_ANSWERS.length}）`)
    console.log('提示：启动后端后可用 GET /api/wordcloud 与 GET /api/wordcloud/participants 查看效果')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
