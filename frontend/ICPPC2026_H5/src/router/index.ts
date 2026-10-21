import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/shared/constants'

const routes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATHS.Home,
    name: ROUTE_NAMES.Home,
    component: () => import('@/views/Home.vue'),
  },
  {
    path: ROUTE_PATHS.Questions,
    name: ROUTE_NAMES.Questions,
    component: () => import('@/views/Questions.vue'),
  },
  {
    path: ROUTE_PATHS.Answer,
    name: ROUTE_NAMES.Answer,
    component: () => import('@/views/Answer.vue'),
  },
  {
    path: ROUTE_PATHS.Success,
    name: ROUTE_NAMES.Success,
    component: () => import('@/views/Success.vue'),
  },
  {
    path: ROUTE_PATHS.Checkin,
    name: ROUTE_NAMES.Checkin,
    component: () => import('@/views/Checkin.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
