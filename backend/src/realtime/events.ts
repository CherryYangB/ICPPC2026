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