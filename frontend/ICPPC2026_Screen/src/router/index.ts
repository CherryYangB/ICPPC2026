import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/shared/constants'

const routes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATHS.Interactive,
    name: ROUTE_NAMES.Interactive,
    component: () => import('@/views/Interactive.vue'),
  },
  {
    path: ROUTE_PATHS.ResourceMap,
    name: ROUTE_NAMES.ResourceMap,
    component: () => import('@/views/ResourceMap.vue'),
  },
]

// BASE_URL 由 vite.config.ts 的 base 决定（'/screen/'），
// history 模式下 /map 的实际地址是 /screen/map。
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
