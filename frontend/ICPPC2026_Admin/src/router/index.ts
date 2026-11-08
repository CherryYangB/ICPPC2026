import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
  },
  {
    path: '/',
    name: 'layout',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: { zh: '总览监控', en: 'Dashboard' } },
      },
      {
        path: 'answers',
        name: 'answers',
        component: () => import('@/views/Answers.vue'),
        meta: { title: { zh: '八问回答管理', en: 'Answers' } },
      },
      {
        path: 'institutions',
        name: 'institutions',
        component: () => import('@/views/Institutions.vue'),
        meta: { title: { zh: '机构管理', en: 'Institutions' } },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/Settings.vue'),
        meta: { title: { zh: '系统设置', en: 'Settings' } },
      },
    ],
  },
]

// BASE_URL 由 vite.config.ts 的 base 决定（'/admin/'），
// history 模式下 /dashboard 的实际地址是 /admin/dashboard。
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  // 未登录：仅放行 /login，其余一律回登录页（记录来源以便登录后跳回）
  if (!authStore.isLoggedIn && to.path !== '/login') {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 已登录：访问 /login 直接进总览
  if (authStore.isLoggedIn && to.path === '/login') {
    return { path: '/dashboard' }
  }

  return true
})

export default router
