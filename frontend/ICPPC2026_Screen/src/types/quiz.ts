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
  /** 回答唯一 id（cuid），用于后台隐藏 / 删除时移除弹幕 */
  answerId: string
  questionId: string
  identityTag: string
  answer: string
  timestamp: string
}

/** 后台隐藏回答：从弹幕队列移除对应条目 */
export interface AnswerHiddenEvent {
  answerId: string
}

/** 后台删除回答：从弹幕队列移除对应条目 */
export interface AnswerDeletedEvent {
  answerId: string
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