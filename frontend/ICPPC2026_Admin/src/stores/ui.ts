import { ref } from 'vue'
import { defineStore } from 'pinia'

const LOCALE_KEY = 'icppc2026_admin.locale'

export type Locale = 'zh' | 'en'

export interface Bilingual {
  zh: string
  en: string
}

function loadLocale(): Locale {
  try {
    return localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export const useUiStore = defineStore('ui', () => {
  const locale = ref<Locale>(loadLocale())

  function setLocale(next: Locale): void {
    locale.value = next
    try {
      localStorage.setItem(LOCALE_KEY, next)
    } catch {
      // Storage 不可用时静默忽略
    }
  }

  function toggleLocale(): void {
    setLocale(locale.value === 'zh' ? 'en' : 'zh')
  }

  /** 当前语言下的主文案 */
  function primary(label: Bilingual): string {
    return locale.value === 'zh' ? label.zh : label.en
  }

  /** 当前语言下的副文案 */
  function secondary(label: Bilingual): string {
    return locale.value === 'zh' ? label.en : label.zh
  }

  return { locale, setLocale, toggleLocale, primary, secondary }
})
