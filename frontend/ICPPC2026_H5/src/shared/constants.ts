export const IDENTITY_OPTIONS = [
  { value: 'physician', zh: '医生', en: 'Physician' },
  { value: 'nurse', zh: '护士', en: 'Nurse' },
  { value: 'social_worker', zh: '社工', en: 'Social Worker' },
  { value: 'psychologist', zh: '心理师', en: 'Psychologist' },
  { value: 'parent', zh: '家长', en: 'Parent' },
  { value: 'volunteer', zh: '志愿者', en: 'Volunteer' },
  { value: 'administrator', zh: '管理者', en: 'Administrator' },
  { value: 'teacher', zh: '教师', en: 'Teacher' },
  { value: 'student', zh: '学生', en: 'Student' },
  { value: 'other', zh: '其他', en: 'Other' },
] as const

export type IdentityTag = (typeof IDENTITY_OPTIONS)[number]['value']

export const QUESTION_IDS = [
  'q1',
  'q2',
  'q3',
  'q4',
  'q5',
  'q6',
  'q7',
  'q8',
] as const

export type QuestionId = (typeof QUESTION_IDS)[number]

export const TOTAL_QUESTIONS = 8

export const QUESTION_CARDS = [
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
] as const

export type QuestionCard = (typeof QUESTION_CARDS)[number]

export const QUESTION_PAGE_SIZE = 4

export const ROUTE_NAMES = {
  Home: 'home',
  Questions: 'questions',
  Answer: 'answer',
  Success: 'success',
  Checkin: 'checkin',
} as const

export const ROUTE_PATHS = {
  Home: '/',
  Questions: '/questions',
  Answer: '/answer/:questionId',
  Success: '/success/:questionId',
  Checkin: '/checkin',
} as const
