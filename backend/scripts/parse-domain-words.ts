import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as mammoth from 'mammoth'

/**
 * 把 src/doc/词表清单.docx 转成后端分词服务可直接加载的三个文件：
 * - src/wordcloud/domain-words.txt  每行一个词（长词在前）
 * - src/wordcloud/synonyms.json     { 原词: 归一目标词 }
 * - src/wordcloud/terms.json        { 任意写法: 词条 }（没有归一目标词时用于显示原词条）
 *
 * 只做「提取 + 去重 + 排序 + 落盘」，不包含任何分词/归一化逻辑。
 * 运行：npm run parse:domain-words
 */

/** 源文件 */
const SOURCE_PATH = resolve(__dirname, '../src/doc/词表清单.docx')
/** 产物 A：词表（每行一个，长度降序） */
const WORDS_OUTPUT_PATH = resolve(__dirname, '../src/wordcloud/domain-words.txt')
/** 产物 B：同义词映射 */
const SYNONYMS_OUTPUT_PATH = resolve(__dirname, '../src/wordcloud/synonyms.json')
/** 产物 C：任意写法 → 词条（没有归一目标词时显示原词条） */
const TERMS_OUTPUT_PATH = resolve(__dirname, '../src/wordcloud/terms.json')

/** 视为「没有值」的占位符（源表用 em dash 表示空缺） */
const PLACEHOLDERS = new Set(['', '—', '–', '-', '/', '无'])

/** 表头行首列文字，用于定位表头 */
const HEADER_FIRST_CELL = '编号'

interface Row {
  /** 编号，如 T-001 */
  code: string
  /** 词条 */
  term: string
  /** 英文或常用写法 */
  alias: string
  /** 归一目标词 */
  target: string
}

type ColumnKey = keyof Row

/** 表头关键字 → 列语义；找不到时退回固定下标 0/1/2/3 */
const HEADER_TOKENS: ReadonlyArray<readonly [ColumnKey, readonly string[]]> = [
  ['code', ['编号']],
  ['term', ['词条']],
  ['alias', ['英文', '常用写法']],
  ['target', ['归一']],
]

const FALLBACK_INDEXES: Record<ColumnKey, number> = { code: 0, term: 1, alias: 2, target: 3 }

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/** mammoth 输出的是干净 HTML：去标签 → 解实体 → 合并空白 */
function cleanCell(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

/** 从 mammoth 生成的 HTML 里抽出「表 → 行 → 单元格」三维数组 */
function extractTables(html: string): string[][][] {
  const tables: string[][][] = []
  for (const tableMatch of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows: string[][] = []
    for (const rowMatch of tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells: string[] = []
      for (const cellMatch of rowMatch[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
        cells.push(cleanCell(cellMatch[1]))
      }
      if (cells.length > 0) rows.push(cells)
    }
    if (rows.length > 0) tables.push(rows)
  }
  return tables
}

/** 按表头文字定位四列；表头列名对不上时返回 null */
function resolveIndexes(header: readonly string[]): Record<ColumnKey, number> | null {
  const indexes = {} as Record<ColumnKey, number>
  for (const [key, tokens] of HEADER_TOKENS) {
    const index = header.findIndex((cell) => tokens.some((token) => cell.includes(token)))
    if (index === -1) return null
    indexes[key] = index
  }
  return indexes
}

interface ParsedRows {
  rows: Row[]
  skippedRows: number
}

/** 跳过表头、补齐空列，返回有效数据行 */
function toRows(tables: string[][][]): ParsedRows {
  const rows: Row[] = []
  let skippedRows = 0

  for (const table of tables) {
    const headerIndex = table.findIndex((cells) => (cells[0] ?? '').includes(HEADER_FIRST_CELL))
    const header = headerIndex === -1 ? null : table[headerIndex]
    const columns = (header ? resolveIndexes(header) : null) ?? FALLBACK_INDEXES
    const maxIndex = Math.max(...Object.values(columns))

    for (const cells of table.slice((header ? headerIndex : 0) + 1)) {
      if (cells.length <= maxIndex) {
        skippedRows += 1
        continue
      }
      const row: Row = {
        code: cells[columns.code] ?? '',
        term: cells[columns.term] ?? '',
        alias: cells[columns.alias] ?? '',
        target: cells[columns.target] ?? '',
      }
      if (isPlaceholder(row.term) && isPlaceholder(row.alias) && isPlaceholder(row.target)) {
        skippedRows += 1
        continue
      }
      rows.push(row)
    }
  }

  return { rows, skippedRows }
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDERS.has(value.trim())
}

/** 去重键：纯 ASCII 词忽略大小写（避免 "Hospice Care" / "hospice care" 重复），中文按原文 */
function dedupeKey(word: string): string {
  return /^[\x20-\x7E]+$/.test(word) ? word.toLowerCase() : word
}

/** 产物 A：词条 + 英文 + 目标词去重，按长度降序（同长按中文排序，保证输出稳定） */
function buildWords(rows: readonly Row[]): string[] {
  const seen = new Set<string>()
  const words: string[] = []

  for (const row of rows) {
    for (const value of [row.term, row.alias, row.target]) {
      if (isPlaceholder(value)) continue
      const key = dedupeKey(value)
      if (seen.has(key)) continue
      seen.add(key)
      words.push(value)
    }
  }

  return words.sort((a, b) => b.length - a.length || a.localeCompare(b, 'zh'))
}

interface SynonymsResult {
  synonyms: Record<string, string>
  conflicts: string[]
}

/**
 * 产物 B：目标词有效时，收录「词条 → 目标词」与「英文 → 目标词」。
 * 自映射（原词 === 目标词）按约定保留；同一原词若出现不同目标，保留首次并记录冲突。
 */
function buildSynonyms(rows: readonly Row[]): SynonymsResult {
  const dictionary = new Map<string, string>()
  const conflicts: string[] = []

  for (const row of rows) {
    if (isPlaceholder(row.target)) continue
    for (const source of [row.term, row.alias]) {
      if (isPlaceholder(source)) continue
      const existing = dictionary.get(source)
      if (existing === undefined) {
        dictionary.set(source, row.target)
        continue
      }
      if (existing !== row.target) {
        conflicts.push(`${source}：${existing} / ${row.target}`)
      }
    }
  }

  const sortedKeys = [...dictionary.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, 'zh'),
  )
  const synonyms: Record<string, string> = {}
  for (const key of sortedKeys) {
    synonyms[key] = dictionary.get(key) as string
  }

  return { synonyms, conflicts }
}

interface TermsResult {
  terms: Record<string, string>
  conflicts: string[]
}

/**
 * 产物 C：任意写法 → 词条。
 * 「词条」自身映射到自身，英文别名映射到所属词条；
 * 与 synonyms 配合：有归一目标词时用目标词，没有时用它显示原本词条。
 */
function buildTerms(rows: readonly Row[]): TermsResult {
  const dictionary = new Map<string, string>()
  const conflicts: string[] = []

  for (const row of rows) {
    if (isPlaceholder(row.term)) continue

    const pairs: Array<[string, string]> = [[row.term, row.term]]
    if (!isPlaceholder(row.alias)) pairs.push([row.alias, row.term])

    for (const [source, term] of pairs) {
      const existing = dictionary.get(source)
      if (existing === undefined) {
        dictionary.set(source, term)
        continue
      }
      if (existing !== term) {
        conflicts.push(`${source}：${existing} / ${term}`)
      }
    }
  }

  const sortedKeys = [...dictionary.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, 'zh'),
  )
  const terms: Record<string, string> = {}
  for (const key of sortedKeys) {
    terms[key] = dictionary.get(key) as string
  }

  return { terms, conflicts }
}

/** 归一目标词里有、但「词条」列里没有的词（分词词典可能因此缺失该词） */
function findMissingTargets(rows: readonly Row[]): string[] {
  const terms = new Set(rows.map((row) => row.term).filter((term) => !isPlaceholder(term)))
  const targets = new Set(rows.map((row) => row.target).filter((target) => !isPlaceholder(target)))
  return [...targets]
    .filter((target) => !terms.has(target))
    .sort((a, b) => a.length - b.length || a.localeCompare(b, 'zh'))
}

function writeOutputs(
  words: readonly string[],
  synonyms: Record<string, string>,
  terms: Record<string, string>,
): void {
  mkdirSync(dirname(WORDS_OUTPUT_PATH), { recursive: true })
  writeFileSync(WORDS_OUTPUT_PATH, `${words.join('\n')}\n`, 'utf8')

  mkdirSync(dirname(SYNONYMS_OUTPUT_PATH), { recursive: true })
  writeFileSync(SYNONYMS_OUTPUT_PATH, `${JSON.stringify(synonyms, null, 2)}\n`, 'utf8')

  mkdirSync(dirname(TERMS_OUTPUT_PATH), { recursive: true })
  writeFileSync(TERMS_OUTPUT_PATH, `${JSON.stringify(terms, null, 2)}\n`, 'utf8')
}

async function main(): Promise<void> {
  if (!existsSync(SOURCE_PATH)) {
    throw new Error(`找不到词表文件：${SOURCE_PATH}`)
  }

  const { value: html, messages } = await mammoth.convertToHtml({ path: SOURCE_PATH })
  for (const message of messages) {
    if (message.type === 'error') {
      console.warn(`[mammoth] ${message.message}`)
    }
  }

  const tables = extractTables(html)
  if (tables.length === 0) {
    throw new Error('docx 解析失败：转换结果里没有任何 <table>，请确认文档仍是表格结构')
  }

  const { rows, skippedRows } = toRows(tables)
  if (rows.length === 0) {
    throw new Error('docx 解析失败：表格结构丢失，未提取到有效数据行（已中止，未覆盖既有产物）')
  }

  const words = buildWords(rows)
  const { synonyms, conflicts } = buildSynonyms(rows)
  const { terms, conflicts: termConflicts } = buildTerms(rows)
  const missingTargets = findMissingTargets(rows)
  const selfMappings = Object.entries(synonyms).filter(([source, target]) => source === target).length

  writeOutputs(words, synonyms, terms)

  console.log(`源文件：${SOURCE_PATH}`)
  console.log(
    `表格 ${tables.length} 张，数据行 ${rows.length} 条${skippedRows > 0 ? `（跳过 ${skippedRows} 行）` : ''}`,
  )
  console.log(`✅ ${WORDS_OUTPUT_PATH}：${words.length} 行`)
  console.log(
    `✅ ${SYNONYMS_OUTPUT_PATH}：${Object.keys(synonyms).length} 条映射` +
      `${selfMappings > 0 ? `（其中自映射 ${selfMappings} 条）` : ''}`,
  )
  console.log(`✅ ${TERMS_OUTPUT_PATH}：${Object.keys(terms).length} 条词条映射`)
  console.log(
    missingTargets.length === 0
      ? '✅ 所有归一目标词都能在「词条」列找到'
      : `⚠️ 词条里找不到的归一目标词（${missingTargets.length}）：${missingTargets.join('、')}`,
  )
  if (conflicts.length > 0) {
    console.warn(`⚠️ 同义词映射冲突 ${conflicts.length} 条（保留首次出现，已忽略后者）：`)
    for (const conflict of conflicts) {
      console.warn(`   - ${conflict}`)
    }
  }
  if (termConflicts.length > 0) {
    console.warn(`⚠️ 词条映射冲突 ${termConflicts.length} 条（保留首次出现，已忽略后者）：`)
    for (const conflict of termConflicts) {
      console.warn(`   - ${conflict}`)
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
