<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')

function readErrorMessage(err: unknown): string {
  const data = (
    err as { response?: { data?: { message?: string | string[] } } } | null
  )?.response?.data
  const message = data?.message
  if (typeof message === 'string' && message.trim()) return message
  if (Array.isArray(message) && message.length > 0) return message.filter(Boolean).join('；')
  return '登录失败，请稍后重试'
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  errorMessage.value = ''

  if (!username.value.trim() || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  submitting.value = true
  try {
    const { token, user } = await login(username.value.trim(), password.value)
    authStore.setToken(token)
    authStore.setUser(user)

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  } catch (err) {
    errorMessage.value = readErrorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="handleSubmit">
      <h1 class="login-title">ICPPC 2026 管理后台</h1>

      <label class="field">
        <span class="field-label">用户名</span>
        <input
          v-model="username"
          class="field-input"
          type="text"
          placeholder="请输入用户名"
          autocomplete="username"
        />
      </label>

      <label class="field">
        <span class="field-label">密码</span>
        <input
          v-model="password"
          class="field-input"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
        />
      </label>

      <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

      <button class="login-button" type="submit" :disabled="submitting">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef3fb 0%, #f5f6f8 100%);
  padding: 24px;
}

.login-card {
  width: 400px;
  max-width: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(31, 35, 41, 0.08);
  padding: 40px 36px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.login-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  text-align: center;
  color: var(--text);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  color: var(--text-muted);
}

.field-input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-active-bg);
}

.error-message {
  margin: 0;
  font-size: 13px;
  color: #e5484d;
}

.login-button {
  height: 44px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.login-button:hover:not(:disabled) {
  background: var(--primary-hover);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
