import service from './request'
import type { Question } from '@/types/question'

export async function fetchQuestions(): Promise<Question[]> {
  const response = await service.get<Question[]>('/questions')
  return response.data
}
