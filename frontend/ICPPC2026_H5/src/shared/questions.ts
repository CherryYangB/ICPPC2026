import { ref } from 'vue'
import { fetchQuestions } from './api'
import { isQuestionId, QUESTION_CARDS, type QuestionCard } from './constants'

/**
 * 当前生效的题目卡片。
 * 先用本地常量兜底，接口成功后替换为后端数据（保证断网 / 后端未播种时页面仍可用）。
 */
export const questionCards = ref<readonly QuestionCard[]>([...QUESTION_CARDS])

/** 数据来源，便于排查（'fallback' = 仍使用本地兜底） */
export const questionCardsSource = ref<'fallback' | 'api'>('fallback')

let loadPromise: Promise<void> | null = null

/**
 * 从 GET /api/questions 拉取题目并映射为卡片。
 * - 失败 / 空数组 / 全部为非法 id：保留本地兜底，不影响页面；
 * - 失败时清空缓存的 Promise，允许下次重试。
 */
export function ensureQuestionCards(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = fetchQuestions()
    .then((list) => {
      const cards: QuestionCard[] = []
      for (const item of list) {
        const id = item.id
        if (!isQuestionId(id)) continue
        cards.push({
          id,
          order: item.order,
          topicZh: item.topicZh,
          topicEn: item.topicEn,
          color: item.color,
          titleZh: item.titleZh,
          titleEn: item.titleEn,
        })
      }
      if (cards.length === 0) return

      cards.sort((a, b) => a.order - b.order)
      questionCards.value = cards
      questionCardsSource.value = 'api'
    })
    .catch(() => {
      loadPromise = null
    })

  return loadPromise
}
