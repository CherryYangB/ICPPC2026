import { IDENTITY_OPTIONS } from './constants'
import type { IdentityTag } from './constants'

const STORAGE_KEY = 'icppc2026_h5.identity'

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