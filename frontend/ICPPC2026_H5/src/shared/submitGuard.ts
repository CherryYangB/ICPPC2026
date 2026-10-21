import type { QuestionId } from './constants'

const STORAGE_KEY = 'icppc2026_h5.answer.lastSubmitAt'

export const SUBMIT_COOLDOWN_MS = 30_000

type SubmitMap = Partial<Record<QuestionId, number>>

function readMap(): SubmitMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as SubmitMap)
      : {}
  } catch {
    return {}
  }
}

function writeMap(map: SubmitMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Storage unavailable (e.g. private mode) — ignore silently.
  }
}

export function getSubmittedAt(questionId: QuestionId): number | null {
  const submittedAt = readMap()[questionId]
  return typeof submittedAt === 'number' && Number.isFinite(submittedAt)
    ? submittedAt
    : null
}

export function getRemainingCooldown(
  questionId: QuestionId,
  now = Date.now(),
): number {
  const submittedAt = getSubmittedAt(questionId)
  if (submittedAt === null) return 0
  return Math.min(
    SUBMIT_COOLDOWN_MS,
    Math.max(0, submittedAt + SUBMIT_COOLDOWN_MS - now),
  )
}

export function markSubmitted(
  questionId: QuestionId,
  now = Date.now(),
): void {
  const map = readMap()
  map[questionId] = now
  writeMap(map)
}
