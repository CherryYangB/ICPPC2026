import type { ApiQuestion, SubmitAnswerRequest, SubmitAnswerResponse } from './types'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message ?? `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function submitAnswer(
  payload: SubmitAnswerRequest,
): Promise<SubmitAnswerResponse> {
  return request<SubmitAnswerResponse>('/answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 题目列表（后端按 order 升序返回裸数组，带 ETag / Cache-Control） */
export function fetchQuestions(): Promise<ApiQuestion[]> {
  return request<ApiQuestion[]>('/questions')
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { message?: string | string[] }
    if (typeof body.message === 'string') return body.message
    if (Array.isArray(body.message)) return body.message.join('；')
  } catch {
    // ignore non-JSON error bodies
  }
  return undefined
}
