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

const SERVICE_TAGS: Array<{ nameZh: string; nameEn: string }> = [
  { nameZh: '临床支持', nameEn: 'Clinical support' },
  { nameZh: '医师培训', nameEn: 'Physician training' },
  { nameZh: '人才培养', nameEn: 'Capacity building' },
  { nameZh: '研究', nameEn: 'Research' },
  { nameZh: '居家照护', nameEn: 'Home care' },
  { nameZh: '家庭支持', nameEn: 'Family support' },
  { nameZh: '社会倡导', nameEn: 'Advocacy' },
  { nameZh: '技术研发', nameEn: 'R&D' },
  { nameZh: '产学研合作', nameEn: 'Industry-academia collaboration' },
]

const INSTITUTIONS: Array<{
  nameZh: string
  nameEn: string
  type: string
  province: string
  city: string
  district?: string
  address?: string
  description: string
  descriptionEn?: string
  tags: string[]
}> = [
  {
    nameZh: '北京协和医院儿科',
    nameEn: 'Peking Union Medical College Hospital, Pediatrics',
    type: 'hospital',
    province: '北京市',
    city: '北京市',
    district: '东城区',
    address: '北京市东城区帅府园一号',
    description: '国家级儿童舒缓疗护临床示范单位，开展症状管理与多学科协作。',
    descriptionEn: 'National clinical demonstration unit for paediatric palliative care.',
    tags: ['临床支持', '医师培训', '人才培养'],
  },
  {
    nameZh: '首都医科大学',
    nameEn: 'Capital Medical University',
    type: 'university',
    province: '北京市',
    city: '北京市',
    district: '丰台区',
    address: '北京市丰台区右安门外西头条10号',
    description: '承担儿科舒缓疗护方向的教学与科研，推动专业人才培养。',
    descriptionEn: 'Teaching and research in paediatric palliative care.',
    tags: ['人才培养', '研究'],
  },
  {
    nameZh: '上海儿童医学中心',
    nameEn: 'Shanghai Children’s Medical Center',
    type: 'hospital',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    address: '上海市浦东新区东方路1678号',
    description: '聚焦儿童居家照护与临终关怀的家庭支持体系建设。',
    descriptionEn: 'Focused on home care and family support for children.',
    tags: ['居家照护', '临床支持'],
  },
  {
    nameZh: '中国生命关怀协会',
    nameEn: 'China Life Care Association',
    type: 'ngo',
    province: '北京市',
    city: '北京市',
    district: '海淀区',
    description: '推动儿童舒缓安宁理念的社会倡导与家庭互助网络。',
    descriptionEn: 'Advocacy and family mutual-help network for paediatric palliative care.',
    tags: ['家庭支持', '社会倡导'],
  },
  {
    nameZh: '华大基因',
    nameEn: 'BGI Genomics',
    type: 'enterprise',
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    address: '广东省深圳市南山区科技园',
    description: '提供基因检测与罕见病相关技术支持，参与产学研协作。',
    descriptionEn: 'Genomic testing and rare-disease technology support.',
    tags: ['技术研发', '产学研合作'],
  },
]

async function main(): Promise<void> {
  for (const q of QUESTIONS) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: q,
      create: q,
    })
  }
  console.log(`Seeded ${QUESTIONS.length} questions`)

  for (const tag of SERVICE_TAGS) {
    await prisma.serviceTag.upsert({
      where: { nameZh: tag.nameZh },
      update: { nameEn: tag.nameEn },
      create: tag,
    })
  }
  console.log(`Seeded ${SERVICE_TAGS.length} service tags`)

  for (const inst of INSTITUTIONS) {
    const existing = await prisma.institution.findFirst({
      where: { nameZh: inst.nameZh },
    })
    if (existing) continue

    const { tags, ...data } = inst
    await prisma.institution.create({
      data: {
        ...data,
        tags: {
          create: tags.map((nameZh) => ({
            tag: { connect: { nameZh } },
          })),
        },
      },
    })
  }
  console.log(`Seeded ${INSTITUTIONS.length} institutions`)
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