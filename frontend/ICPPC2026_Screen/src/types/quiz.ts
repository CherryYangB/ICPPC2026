export interface Question {
  id: string
  order: number
  topicZh: string
  topicEn: string
  color: string
  titleZh: string
  titleEn: string
}

export interface WordCloudItem {
  word: string
  count: number
}

export type WordCloudMap = Record<string, WordCloudItem[]>

export interface NewAnswerEvent {
  questionId: string
  identityTag: string
  answer: string
  timestamp: string
}

export interface WordCloudUpdateEvent {
  questionId: string
  words: WordCloudItem[]
  timestamp: string
}

/** 参与人数（按 clientIp 去重） */
export interface ParticipantCountEvent {
  count: number
}