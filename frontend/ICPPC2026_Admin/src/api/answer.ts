import service from './request'
import type { AdminAnswer, PaginatedAdminAnswers, QueryAdminAnswers } from '@/types/answer'

export async function fetchAnswers(params: QueryAdminAnswers = {}): Promise<PaginatedAdminAnswers> {
  const query = new URLSearchParams()
  if (params.questionId) query.set('questionId', params.questionId)
  if (params.identityTag) query.set('identityTag', params.identityTag)
  if (params.isHidden !== undefined) query.set('isHidden', String(params.isHidden))
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))

  const search = query.toString()
  const response = await service.get<PaginatedAdminAnswers>(`/admin/answers${search ? `?${search}` : ''}`)
  return response.data
}

export async function setAnswerVisibility(id: string, isHidden: boolean): Promise<AdminAnswer> {
  const response = await service.patch<AdminAnswer>(`/admin/answers/${id}/visibility`, { isHidden })
  return response.data
}

export async function updateAnswer(id: string, answer: string): Promise<AdminAnswer> {
  const response = await service.patch<AdminAnswer>(`/admin/answers/${id}`, { answer })
  return response.data
}

export async function deleteAnswer(id: string): Promise<{ success: boolean }> {
  const response = await service.delete<{ success: boolean }>(`/admin/answers/${id}`)
  return response.data
}

export async function batchHide(ids: string[]): Promise<{ updated: number }> {
  const response = await service.post<{ updated: number }>('/admin/answers/batch-hide', { ids })
  return response.data
}

export async function batchDelete(ids: string[]): Promise<{ deleted: number }> {
  const response = await service.post<{ deleted: number }>('/admin/answers/batch-delete', { ids })
  return response.data
}
