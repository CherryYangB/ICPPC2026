import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

/** 后端 API 前缀；dev 由 Vite 代理 /api → localhost:3000，生产同域反代 */
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10000,
})

// 请求拦截：自动携带 JWT token
service.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`
  }
  return config
})

// 响应拦截：401 时清空登录态并跳登录页（登录接口本身的 401 由登录页自行展示，不在此跳转）
service.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      if (router.currentRoute.value.path !== '/login') {
        void router.push({ path: '/login' })
      }
    }
    return Promise.reject(error)
  },
)

export default service
