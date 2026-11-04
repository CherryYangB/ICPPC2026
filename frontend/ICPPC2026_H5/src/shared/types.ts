import type { IdentityTag, QuestionId } from './constants'

/** 后端 GET /questions 返回的题目 DTO（与 backend QuestionDto 一致） */
export interface ApiQuestion {
  id: string
  order: number
  topicZh: string
  topicEn: string
  color: string
  titleZh: string
  titleEn: string
}

/** 与 backend CreateAnswerDto 一致：answer 为 1..100 的字符串（后端不接受数组） */
export interface SubmitAnswerRequest {
  questionId: QuestionId
  identityTag: IdentityTag
  answer: string
}

/** 与 backend SubmitAnswerResponseDto 一致 */
export interface SubmitAnswerResponse {
  success: boolean
  nextQuestionId?: QuestionId
  completed?: boolean
}
