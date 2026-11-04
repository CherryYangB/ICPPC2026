export interface NewAnswerEvent {
  id: string
  questionId: string
  questionOrder: number
  identityTag: string
  identityTagZh: string
  identityTagEn: string
  answer: string
  submittedAt: string
}

/**
 * 机构打卡广播负载：与 POST /api/institutions/:id/checkin 的响应字段一致（不含 litAt）。
 * 仅在首次点亮时广播，因此 alreadyLit 恒为 false；重复打卡（alreadyLit）不会广播。
 */
export interface InstitutionCheckinEvent {
  success: boolean
  alreadyLit: boolean
  institutionId: number
  nameZh: string
  province: string
  city: string
  litInstitutions: number
  litProvinces: number
  litCities: number
}
