import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuthUser } from '@/types/auth'

const TOKEN_KEY = 'icppc2026_admin.token'

function loadToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(loadToken())
  const user = ref<AuthUser | null>(null)

  const isLoggedIn = computed(() => token.value !== '')

  function setToken(next: string): void {
    token.value = next
    try {
      if (next) {
        localStorage.setItem(TOKEN_KEY, next)
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
    } catch {
      // Storage 不可用（如隐私模式）时静默忽略
    }
  }

  function setUser(next: AuthUser | null): void {
    user.value = next
  }

  function logout(): void {
    setToken('')
    setUser(null)
  }

  return { token, user, isLoggedIn, setToken, setUser, logout }
})
