import type { Institution } from '@/types/institution'

/** 后端 API 前缀；dev 由 Vite 代理 /api → localhost:3000，生产同域反代 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** 机构类型筛选：ward = 有合作病房，clinic = 有舒缓门诊（与后端 QueryInstitutionsDto 对齐） */
export type ApiInstitutionType = 'ward' | 'clinic'

/** 后端 GET /institutions 返回的机构 DTO（与 backend InstitutionDto 保持一致） */
export interface ApiInstitution {
  id: number
  /** 省份短名，如「广东」「安徽」「北京」 */
  province: string
  /** 城市名，保留源表写法，如「深圳市」 */
  city: string
  nameZh: string
  nameEn: string | null
  hasWard: boolean
  hasClinic: boolean
  wardProjects: string[]
  clinicDepartments: string[]
  typeTags: string[]
  longitude: number
  latitude: number
  isLit: boolean
}

/** 后端 GET /institutions/stats 返回结构 */
export interface InstitutionStats {
  totalInstitutions: number
  litInstitutions: number
  litProvinces: number
  litCities: number
}

export interface FetchInstitutionsParams {
  type?: ApiInstitutionType
  province?: string
  keyword?: string
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

/** 机构列表；type / province / keyword 为空时不拼进 query */
export function fetchInstitutions(params: FetchInstitutionsParams = {}): Promise<ApiInstitution[]> {
  const query = new URLSearchParams()
  if (params.type) query.set('type', params.type)
  if (params.province?.trim()) query.set('province', params.province.trim())
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())

  const search = query.toString()
  return request<ApiInstitution[]>(`/institutions${search ? `?${search}` : ''}`)
}

/** 机构总量 + 已点亮统计（省/市按去重计数） */
export function fetchInstitutionStats(): Promise<InstitutionStats> {
  return request<InstitutionStats>('/institutions/stats')
}

/** 已点亮机构列表（大屏初始化发光状态用） */
export function fetchCheckedInInstitutions(): Promise<ApiInstitution[]> {
  return request<ApiInstitution[]>('/institutions/checked-in')
}

const PROVINCE_SUFFIXES = ['特别行政区', '维吾尔自治区', '壮族自治区', '回族自治区', '自治区', '省', '市']

/** 省份短名归一：广东省 → 广东；内蒙古自治区 → 内蒙古。与后端 normalizeProvince 一致 */
export function normalizeProvinceName(raw: string): string {
  let name = raw.replace(/\s+/g, '')
  for (const suffix of PROVINCE_SUFFIXES) {
    if (name.length > suffix.length && name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length)
      break
    }
  }
  return name
}

/** 卡片展示用类型标签（由 hasWard/hasClinic 推导） */
function describeInstitutionType(dto: ApiInstitution): string {
  if (dto.hasWard && dto.hasClinic) return '安宁疗护病房 · 舒缓门诊'
  if (dto.hasWard) return '安宁疗护病房'
  if (dto.hasClinic) return '舒缓门诊'
  return '其他'
}

/**
 * 后端 DTO → 大屏视图模型。
 * 关键：1 条 DTO 恒等于 1 家机构，绝不按 wardProjects/clinicDepartments 展开，
 * 保证地图聚合按机构计数（同一机构多个项目只算 1 家）。
 */
export function toInstitution(dto: ApiInstitution): Institution {
  const tags = [...dto.wardProjects, ...dto.clinicDepartments].filter(
    (value, index, list) => value !== '' && list.indexOf(value) === index,
  )

  return {
    id: String(dto.id),
    name: dto.nameZh,
    nameEn: dto.nameEn ?? undefined,
    province: normalizeProvinceName(dto.province),
    city: dto.city,
    longitude: dto.longitude,
    latitude: dto.latitude,
    type: describeInstitutionType(dto),
    hasWard: dto.hasWard,
    hasClinic: dto.hasClinic,
    wardProjects: dto.wardProjects,
    clinicDepartments: dto.clinicDepartments,
    tags: tags.length > 0 ? tags : undefined,
    isLit: dto.isLit,
  }
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