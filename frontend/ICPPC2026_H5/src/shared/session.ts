import { IDENTITY_OPTIONS } from './constants'
import type { IdentityTag, QuestionId } from './constants'

const STORAGE_KEY = 'icppc2026_h5.identity'
const DRAFT_KEY_PREFIX = 'icppc2026_h5.draft.'

export function isIdentityTag(value: unknown): value is IdentityTag {
  return (
    typeof value === 'string' &&
    IDENTITY_OPTIONS.some((option) => option.value === value)
  )
}

export function loadIdentityTag(): IdentityTag | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw !== null && isIdentityTag(raw) ? raw : null
  } catch {
    return null
  }
}

export function saveIdentityTag(tag: IdentityTag): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, tag)
  } catch {
    // Storage unavailable (e.g. private mode) — ignore silently.
  }
}

export function loadDraft(questionId: QuestionId): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY_PREFIX + questionId) ?? ''
  } catch {
    return ''
  }
}

export function saveDraft(questionId: QuestionId, text: string): void {
  try {
    const key = DRAFT_KEY_PREFIX + questionId
    if (text.length > 0) {
      sessionStorage.setItem(key, text)
    } else {
      sessionStorage.removeItem(key)
    }
  } catch {
    // Storage unavailable (e.g. private mode) — ignore silently.
  }
}

export function clearDraft(questionId: QuestionId): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY_PREFIX + questionId)
  } catch {
    // Storage unavailable (e.g. private mode) — ignore silently.
  }
}
