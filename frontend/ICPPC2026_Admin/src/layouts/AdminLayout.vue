<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { getProfile } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Bilingual } from '@/stores/ui'
import { ROLE_LABELS } from '@/types/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const ui = useUiStore()

const MENU: Array<{ path: string; label: Bilingual }> = [
  { path: '/dashboard', label: { zh: '总览监控', en: 'Dashboard' } },
  { path: '/answers', label: { zh: '八问回答', en: 'Answers' } },
  { path: '/institutions', label: { zh: '机构管理', en: 'Institutions' } },
  { path: '/settings', label: { zh: '系统设置', en: 'Settings' } },
]

const accountLabel: Bilingual = { zh: '管理员账号', en: 'Admin account' }
const logoutLabel: Bilingual = { zh: '退出登录', en: 'Sign out' }

const pageTitle = computed<Bilingual>(() => (route.meta.title as Bilingual) ?? { zh: '', en: '' })

const displayName = computed(() => authStore.user?.displayName || authStore.user?.username || '')

const ROLE_EN: Record<string, string> = { super_admin: 'Super admin', admin: 'Admin', viewer: 'Viewer' }
const roleLabel = computed<Bilingual>(() => {
  if (!authStore.user) return { zh: '', en: '' }
  const zh = ROLE_LABELS[authStore.user.role] ?? authStore.user.role
  return { zh, en: ROLE_EN[authStore.user.role] ?? zh }
})

const avatarChar = computed(() => displayName.value.charAt(0) || 'A')

const now = ref('')
let timer: number | undefined

function tickClock(): void {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  now.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function handleLogout(): void {
  authStore.logout()
  void router.push('/login')
}

onMounted(async () => {
  tickClock()
  timer = window.setInterval(tickClock, 30000)

  // 刷新页面后 token 仍在但 user 在内存中丢失，这里回填当前用户资料
  if (authStore.token && !authStore.user) {
    try {
      authStore.setUser(await getProfile())
    } catch {
      // 401 已由拦截器统一登出并跳转登录页
    }
  }
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo">♥</div>
        <div class="brand-text">
          <span class="bi-primary">儿童舒缓安宁国际交流大会2026</span>
          <span class="bi-secondary">Paediatric Palliative Care</span>
          <div class="brand-tag">
            <span class="dot"></span>
            <span>2026 · 管理后台</span>
            <span class="muted">Admin</span>
          </div>
        </div>
      </div>

      <nav class="menu">
        <RouterLink v-for="item in MENU" :key="item.path" :to="item.path" class="menu-item">
          <span class="menu-icon"></span>
          <span class="menu-text">
            <span class="bi-primary">{{ ui.primary(item.label) }}</span>
            <span class="bi-secondary">{{ ui.secondary(item.label) }}</span>
          </span>
        </RouterLink>
      </nav>

      <div class="sidebar-bottom">
        <div class="account-info">
          <span class="bi-primary">{{ ui.primary(accountLabel) }}</span>
          <span class="bi-secondary">{{ ui.secondary(accountLabel) }}</span>
          <div class="role-tag">
            <span class="dot"></span>
            <span>{{ ui.primary(roleLabel) }}</span>
            <span class="muted">{{ ui.secondary(roleLabel) }}</span>
          </div>
        </div>
        <button class="logout" type="button" @click="handleLogout">
          <span class="bi-primary">{{ ui.primary(logoutLabel) }}</span>
          <span class="bi-secondary">{{ ui.secondary(logoutLabel) }}</span>
        </button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="page-title">
          <span class="bi-primary">{{ ui.primary(pageTitle) }}</span>
          <span class="bi-secondary">{{ ui.secondary(pageTitle) }}</span>
        </div>
        <div class="top-actions">
          <div class="lang-switch">
            <button :class="{ active: ui.locale === 'zh' }" type="button" @click="ui.setLocale('zh')">中</button>
            <button :class="{ active: ui.locale === 'en' }" type="button" @click="ui.setLocale('en')">EN</button>
          </div>
          <span class="clock">{{ now }}</span>
          <div class="avatar">{{ avatarChar }}</div>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);
  background: #fff;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}

.brand-logo {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 10px;
  background: var(--primary-active-bg);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.brand-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text);
}

.brand-tag .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
  flex: none;
}

.menu {
  flex: 1;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 20px;
  transition: background 0.15s;
}

.menu-item:hover {
  background: var(--bg);
}

.menu-item.router-link-active {
  background: #ebf3fe;
}

.menu-item.router-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--primary);
}

.menu-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c3c9d2;
  flex: none;
}

.menu-item.router-link-active .menu-icon {
  background: var(--primary);
}

.menu-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.menu-item.router-link-active .bi-primary {
  color: var(--primary);
  font-weight: 500;
}

.sidebar-bottom {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #f7f9fc;
  align-self: flex-start;
  margin-top: 4px;
}

.role-tag .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--primary);
  flex: none;
}

.logout {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 8px 0;
  text-align: left;
  color: var(--text);
}

.logout:hover .bi-primary {
  color: #eb5757;
}

.bi-primary {
  font-size: 14px;
  color: var(--text);
}

.bi-secondary {
  font-size: 12px;
  color: var(--text-muted);
}

.muted {
  font-size: 12px;
  color: var(--text-muted);
}

.main {
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid var(--border);
}

.page-title {
  display: flex;
  flex-direction: column;
}

.page-title .bi-primary {
  font-size: 18px;
  font-weight: 600;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.lang-switch {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: #f7f9fc;
}

.lang-switch button {
  border: none;
  background: transparent;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-muted);
}

.lang-switch button.active {
  background: var(--primary);
  color: #fff;
}

.clock {
  font-size: 13px;
  color: var(--text-muted);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f7f9fc;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.content {
  flex: 1;
  padding: 24px;
  background: var(--bg);
}
</style>
