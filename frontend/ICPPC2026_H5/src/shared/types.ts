import type { IdentityTag, QuestionId } from './constants'

export type QuestionType = 'single' | 'multiple' | 'text'

export interface QuestionOption {
  value: string
  label: string
}

export interface Question {
  id: QuestionId
  order: number
  title: string
  type: QuestionType
  required: boolean
  options?: QuestionOption[]
}

export interface Questionnaire {
  id: string
  title: string
  questions: Question[]
}

export type AnswerValue = string | string[]

export interface AnswerItem {
  questionId: QuestionId
  value: AnswerValue
}

export interface SubmitAnswerRequest {
  questionId: QuestionId
  identityTag: IdentityTag
  answer: AnswerValue
}

export interface SubmitAnswerResponse {
  success: boolean
  nextQuestionId?: QuestionId
  completed?: boolean
}

export interface SocketMessage<T = unknown> {
  type: string
  payload?: T
}

// 与后端 WebSocket `newAnswer` 事件负载保持一致
export interface NewAnswerEvent {
  id: string
  questionId: QuestionId
  questionOrder: number
  identityTag: IdentityTag
  identityTagZh: string
  identityTagEn: string
  answer: string
  submittedAt: string
}
