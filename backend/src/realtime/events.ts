/** 答题弹幕广播负载（不含任何客户端 IP） */
export interface NewAnswerEvent {
  /** Answer.id（cuid）：后台隐藏 / 删除时大屏据此移除弹幕 */
  answerId: string
  questionId: string
  identityTag: string
  answer: string
  /** 提交时间，ISO 字符串 */
  timestamp: string
}

/** 后台隐藏回答：大屏从弹幕队列移除对应条目 */
export interface AnswerHiddenEvent {
  answerId: string
}

/** 后台删除回答：大屏从弹幕队列移除对应条目 */
export interface AnswerDeletedEvent {
  answerId: string
}

/** 后台撤销机构打卡：大屏移除该机构发光效果 */
export interface InstitutionCheckinRevokedEvent {
  institutionId: number
  province: string
}

/** 词云更新广播负载：由 WordcloudScheduler 节流广播（每 5 秒最多一次/问题） */
export interface WordCloudUpdateEvent {
  questionId: string
  words: Array<{ word: string; count: number }>
  timestamp: string
}

/** 参与人数（按 clientIp 去重的答题人数） */
export interface ParticipantCountEvent {
  count: number
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
