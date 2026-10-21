export const IDENTITIES = [
  'physician',
  'nurse',
  'social_worker',
  'psychologist',
  'parent',
  'volunteer',
  'administrator',
  'teacher',
  'student',
  'other',
] as const

export type IdentityTag = (typeof IDENTITIES)[number]

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