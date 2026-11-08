import service from './request'
import type { AuthUser } from '@/types/auth'

export interface LoginResponse {
  token: string
  user: AuthUser
}

/** 后台登录：POST /api/auth/login */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await service.post<LoginResponse>('/auth/login', { username, password })
  return response.data
}

/** 当前登录用户：GET /api/auth/me（刷新页面后回填用户信息用） */
export async function getProfile(): Promise<AuthUser> {
  const response = await service.get<AuthUser>('/auth/me')
  return response.data
}
