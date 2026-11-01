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

/** 机构打卡：大屏收到后点亮对应机构，并按计数刷新 KPI */
export interface InstitutionCheckinEvent {
  institutionId: number
  province: string
  city: string
  nameZh: string
  litInstitutions: number
  litProvinces: number
}
