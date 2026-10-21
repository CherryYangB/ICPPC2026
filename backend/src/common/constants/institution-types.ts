export const INSTITUTION_TYPES = [
  'hospital',
  'university',
  'research_institute',
  'ngo',
  'foundation',
  'enterprise',
  'government',
  'other',
] as const

export type InstitutionType = (typeof INSTITUTION_TYPES)[number]

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, { zh: string; en: string }> = {
  hospital: { zh: '医院', en: 'Hospital' },
  university: { zh: '高校', en: 'University' },
  research_institute: { zh: '研究机构', en: 'Research institute' },
  ngo: { zh: '社会组织', en: 'NGO' },
  foundation: { zh: '基金会', en: 'Foundation' },
  enterprise: { zh: '企业', en: 'Enterprise' },
  government: { zh: '政府机构', en: 'Government' },
  other: { zh: '其他', en: 'Other' },
}