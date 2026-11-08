export type IdentityTag =
  | 'physician'
  | 'nurse'
  | 'social_worker'
  | 'psychologist'
  | 'parent'
  | 'volunteer'
  | 'administrator'
  | 'teacher'
  | 'student'
  | 'other'

export const IDENTITY_LABELS: Record<IdentityTag, { zh: string; en: string }> = {
  physician: { zh: '医生', en: 'Physician' },
  nurse: { zh: '护士', en: 'Nurse' },
  social_worker: { zh: '社工', en: 'Social Worker' },
  psychologist: { zh: '心理师', en: 'Psychologist' },
  parent: { zh: '家长', en: 'Parent' },
  volunteer: { zh: '志愿者', en: 'Volunteer' },
  administrator: { zh: '管理者', en: 'Administrator' },
  teacher: { zh: '教师', en: 'Teacher' },
  student: { zh: '学生', en: 'Student' },
  other: { zh: '其他', en: 'Other' },
}

export const IDENTITY_TAGS = Object.keys(IDENTITY_LABELS) as IdentityTag[]

/** 回答管理列表项（与后端 AdminAnswerDto 对齐，不含 clientIp） */
export interface AdminAnswer {
  id: string
  questionId: string
  identityTag: string
  answer: string
  isHidden: boolean
  createdAt: string
}

export interface PaginatedAdminAnswers {
  items: AdminAnswer[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface QueryAdminAnswers {
  questionId?: string
  identityTag?: string
  isHidden?: boolean
  keyword?: string
  page?: number
  pageSize?: number
}
