import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 八问：逐字取自 frontend/ICPPC2026_H5/src/shared/constants.ts 的 QUESTION_CARDS
const QUESTIONS = [
  {
    id: 'q1',
    order: 1,
    topicZh: '症状管理',
    topicEn: 'Symptom management',
    color: '#2f80ed',
    titleZh: '我们需要怎样的临床标准?',
    titleEn: 'What clinical standards do we need?',
  },
  {
    id: 'q2',
    order: 2,
    topicZh: '护理/ECHO',
    topicEn: 'Nursing / ECHO',
    color: '#27ae60',
    titleZh: '如何建立全国人才培养体系?',
    titleEn: 'How can we build a national capacity-building system?',
  },
  {
    id: 'q3',
    order: 3,
    topicZh: '医师培训',
    topicEn: 'Physician training',
    color: '#9b51e0',
    titleZh: '如何让儿科医生具备舒缓疗护能力?',
    titleEn: 'How can paediatricians be equipped for palliative care?',
  },
  {
    id: 'q4',
    order: 4,
    topicZh: '社工与家庭',
    topicEn: 'Social work & families',
    color: '#f2994a',
    titleZh: '如何建立家庭支持体系?',
    titleEn: 'How can we build a family support system?',
  },
  {
    id: 'q5',
    order: 5,
    topicZh: '沟通',
    topicEn: 'Communication',
    color: '#2d9cdb',
    titleZh: '儿童和家庭的声音如何进入决策?',
    titleEn: "How do children's and families' voices enter decision-making?",
  },
  {
    id: 'q6',
    order: 6,
    topicZh: '居家照护',
    topicEn: 'Home care',
    color: '#eb5757',
    titleZh: '医院之外谁来接住孩子?',
    titleEn: 'Who catches the child beyond the hospital?',
  },
  {
    id: 'q7',
    order: 7,
    topicZh: '创伤与自我照护',
    topicEn: 'Trauma & self-care',
    color: '#bb6bd9',
    titleZh: '如何建设可持续的专业队伍?',
    titleEn: 'How can we build a sustainable professional workforce?',
  },
  {
    id: 'q8',
    order: 8,
    topicZh: 'MDT',
    topicEn: 'Multidisciplinary team',
    color: '#f2c94c',
    titleZh: '如何从团队协作走向行业协作?',
    titleEn: 'How do we move from team collaboration to sector-wide collaboration?',
  },
]

interface InstitutionSeedRecord {
  nameZh: string
  province: string
  city: string
  nameEn?: string | null
  hasWard: boolean
  hasClinic: boolean
  wardProjects: string[]
  clinicDepartments: string[]
  typeTags: string[]
  longitude: number
  latitude: number
}

const INSTITUTIONS_FILE = join(__dirname, 'seed-data', 'institutions.json')

async function seedInstitutions(): Promise<void> {
  if (!existsSync(INSTITUTIONS_FILE)) {
    console.warn('[warn] 未找到 ' + INSTITUTIONS_FILE + '，跳过机构播种（先执行 npm run clean:institutions）')
    return
  }

  const records = JSON.parse(readFileSync(INSTITUTIONS_FILE, 'utf8')) as InstitutionSeedRecord[]
  for (const record of records) {
    const { province, city, nameZh, ...rest } = record
    await prisma.institution.upsert({
      where: { province_city_nameZh: { province, city, nameZh } },
      update: { province, city, nameZh, ...rest },
      create: { province, city, nameZh, ...rest },
    })
  }
  console.log(`已导入 ${records.length} 家机构`)
}

async function main(): Promise<void> {
  for (const q of QUESTIONS) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: q,
      create: q,
    })
  }
  console.log(`Seeded ${QUESTIONS.length} questions`)

  await seedInstitutions()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })