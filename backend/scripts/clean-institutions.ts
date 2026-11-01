import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { CITY_COORDINATES } from './city-coordinates'
import { normalizeProvince } from '../src/common/utils/province'

/** 源表：backend/src/doc/合作病房舒缓门诊目录.xlsx */
const SOURCE_PATH = resolve(__dirname, '../src/doc/合作病房舒缓门诊目录.xlsx')
/** 输出：backend/prisma/seed-data/institutions.json */
const OUTPUT_PATH = resolve(__dirname, '../prisma/seed-data/institutions.json')

const WARD_SHEET_NAME = '安宁疗护病房'
const CLINIC_SHEET_NAME = '舒缓门诊'

/** 城市后缀，仅用于查经纬度表 */
const CITY_SUFFIXES = ['自治州', '地区', '市', '盟']
/** 源表里的占位文本，不进入项目/科室数组 */
const PLACEHOLDER_VALUES = new Set(['未注明', '未注明项目名'])
/** 表头识别词：一行命中 2 个及以上即视为表头（源表有「机构地」这类错别字，故不依赖单一列名） */
const HEADER_TOKENS = ['城市', '省份', '机构名', '机构地', '医院', '项目名', '科室']

type Cell = string | number | boolean | null | undefined
type SheetKind = 'ward' | 'clinic'

export interface InstitutionSeed {
  province: string
  city: string
  nameZh: string
  hasWard: boolean
  hasClinic: boolean
  wardProjects: string[]
  clinicDepartments: string[]
  typeTags: string[]
  longitude: number
  latitude: number
}

interface InstitutionDraft {
  province: string
  city: string
  nameZh: string
  hasWard: boolean
  hasClinic: boolean
  wardProjects: string[]
  clinicDepartments: string[]
  longitude: number
  latitude: number
}

function toText(value: Cell): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 城市名去掉行政区后缀，用于查经纬度表：合肥市 → 合肥；恩施市 → 恩施。 */
export function normalizeCityKey(raw: string): string {
  const name = raw.replace(/\s+/g, '')
  for (const suffix of CITY_SUFFIXES) {
    if (name.length > suffix.length && name.endsWith(suffix)) {
      return name.slice(0, -suffix.length)
    }
  }
  return name
}

function isHeaderRow(cells: Cell[]): boolean {
  const texts = cells.map(toText)
  return HEADER_TOKENS.filter((token) => texts.includes(token)).length >= 2
}

function addValue(list: string[], value: string): void {
  if (!value || PLACEHOLDER_VALUES.has(value)) {
    return
  }
  if (!list.includes(value)) {
    list.push(value)
  }
}

function readSheet(workbook: XLSX.WorkBook, sheetName: string): Cell[][] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`未找到 sheet「${sheetName}」，实际存在的 sheet：${workbook.SheetNames.join('、')}`)
  }
  return XLSX.utils.sheet_to_json<Cell[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })
}

function resolveCoordinate(city: string): { longitude: number; latitude: number } | null {
  const coordinate = CITY_COORDINATES[normalizeCityKey(city)]
  return coordinate ? { longitude: coordinate.lng, latitude: coordinate.lat } : null
}

function buildInstitutions(): { institutions: InstitutionSeed[]; skipped: string[] } {
  if (!existsSync(SOURCE_PATH)) {
    throw new Error(`源表不存在：${SOURCE_PATH}`)
  }

  const workbook = XLSX.readFile(SOURCE_PATH)
  const drafts = new Map<string, InstitutionDraft>()
  const skipped: string[] = []

  const register = (province: string, city: string, nameZh: string, kind: SheetKind, detail: string): void => {
    const coordinate = resolveCoordinate(city)
    if (!coordinate) {
      const entry = `${province}/${city}/${nameZh}`
      skipped.push(entry)
      const sheetName = kind === 'ward' ? WARD_SHEET_NAME : CLINIC_SHEET_NAME
      console.warn(`[skip] 城市未匹配到经纬度（${sheetName}）：${entry}`)
      return
    }

    const key = `${province}|${city}|${nameZh}`
    let draft = drafts.get(key)
    if (!draft) {
      draft = {
        province,
        city,
        nameZh,
        hasWard: false,
        hasClinic: false,
        wardProjects: [],
        clinicDepartments: [],
        longitude: coordinate.longitude,
        latitude: coordinate.latitude,
      }
      drafts.set(key, draft)
    }

    if (kind === 'ward') {
      draft.hasWard = true
      addValue(draft.wardProjects, detail)
    } else {
      draft.hasClinic = true
      addValue(draft.clinicDepartments, detail)
    }
  }

  // sheet 1：省份标题行 + 表头行 + 数据行（城市 / 机构名 / 项目名）
  let currentProvince = ''
  for (const row of readSheet(workbook, WARD_SHEET_NAME)) {
    if (isHeaderRow(row)) {
      continue
    }
    const city = toText(row[0])
    const nameZh = toText(row[1])
    const project = toText(row[2])

    if (!nameZh) {
      // 省份标题行只有 A 列有值；缺机构名的数据行单独告警
      if (!city) {
        continue
      }
      if (!project) {
        currentProvince = normalizeProvince(city)
        continue
      }
      console.warn(`[skip] 缺少机构名：${city}/${project}`)
      continue
    }
    if (!currentProvince) {
      console.warn(`[skip] 缺少省份标题行：${city}/${nameZh}`)
      continue
    }
    register(currentProvince, city, nameZh, 'ward', project)
  }

  // sheet 2：单行表头 + 数据行（省份 / 城市 / 医院 / 科室）
  for (const row of readSheet(workbook, CLINIC_SHEET_NAME)) {
    if (isHeaderRow(row)) {
      continue
    }
    const province = toText(row[0])
    const city = toText(row[1])
    const nameZh = toText(row[2])
    const department = toText(row[3])

    if (!province || !city || !nameZh) {
      if (nameZh) {
        console.warn(`[skip] 门诊行字段不完整：${province}/${city}/${nameZh}`)
      }
      continue
    }
    register(normalizeProvince(province), city, nameZh, 'clinic', department)
  }

  const institutions: InstitutionSeed[] = []
  for (const draft of drafts.values()) {
    const typeTags: string[] = []
    if (draft.hasWard) {
      typeTags.push('ward')
    }
    if (draft.hasClinic) {
      typeTags.push('clinic')
    }
    institutions.push({
      province: draft.province,
      city: draft.city,
      nameZh: draft.nameZh,
      hasWard: draft.hasWard,
      hasClinic: draft.hasClinic,
      wardProjects: draft.wardProjects,
      clinicDepartments: draft.clinicDepartments,
      typeTags,
      longitude: draft.longitude,
      latitude: draft.latitude,
    })
  }

  if (institutions.length === 0) {
    throw new Error('清洗结果为空，请检查源表结构是否变化')
  }

  return { institutions, skipped }
}

/** 名称去掉括号内容与 · 后缀后相同、但没有合并的机构（仅提示，不改数据） */
function findNearDuplicates(institutions: InstitutionSeed[]): string[][] {
  const buckets = new Map<string, string[]>()
  for (const item of institutions) {
    const core = item.nameZh
      .replace(/[（(][^（）()]*[）)]/g, '')
      .replace(/·.*$/, '')
      .trim()
    const key = `${item.province}|${core}`
    const names = buckets.get(key) ?? []
    names.push(item.nameZh)
    buckets.set(key, names)
  }
  return [...buckets.values()].filter((names) => names.length > 1)
}

function printStats(institutions: InstitutionSeed[], skipped: string[]): void {
  const wardCount = institutions.filter((item) => item.hasWard).length
  const clinicCount = institutions.filter((item) => item.hasClinic).length
  const bothCount = institutions.filter((item) => item.hasWard && item.hasClinic).length

  const byProvince = new Map<string, number>()
  for (const item of institutions) {
    byProvince.set(item.province, (byProvince.get(item.province) ?? 0) + 1)
  }
  const provinceRows = [...byProvince.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'),
  )

  console.log('\n=== 清洗完成 ===')
  console.log(`机构总数: ${institutions.length}`)
  console.log(`覆盖病房: ${wardCount}    覆盖门诊: ${clinicCount}    两者都有: ${bothCount}`)
  console.log(`省份数量: ${byProvince.size}`)
  console.log('按省份分布:')
  for (const [province, count] of provinceRows) {
    console.log(`  ${province}: ${count}`)
  }
  console.log(`匹配不到坐标的机构(${skipped.length}): ${skipped.length > 0 ? skipped.join('、') : '无'}`)

  const nearDuplicates = findNearDuplicates(institutions)
  if (nearDuplicates.length > 0) {
    console.log(`疑似同一机构但名称不同(${nearDuplicates.length} 组，未合并):`)
    for (const names of nearDuplicates) {
      console.log(`  - ${names.join(' | ')}`)
    }
  }

  console.log(`输出文件: ${OUTPUT_PATH}`)
}

function main(): void {
  const { institutions, skipped } = buildInstitutions()

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(institutions, null, 2)}\n`, 'utf8')

  printStats(institutions, skipped)
}

try {
  main()
} catch (error) {
  console.error(`[fatal] 清洗失败: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}

