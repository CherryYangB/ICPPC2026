import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Jieba } from '@node-rs/jieba'
import { dict } from '@node-rs/jieba/dict'
import { PrismaService } from '../prisma/prisma.service'
import { QUESTION_IDS } from '../answers/dto/create-answer.dto'
import { STOPWORDS } from './stopwords'

/**
 * 词云统计：
 * 1) 保护性替换：按领域词表（最长匹配）把词条/英文写法替换成占位符，避免被 jieba 切碎
 * 2) jieba cutForSearch 分词
 * 3) 还原占位符
 * 4) 归一：有「归一目标词」时用目标词；没有时保留词条本身（英文写法归到对应中文词条）
 * 5) 按出现次数统计
 *
 * 因此词云里出现的都是词表清单里的词条或归一目标词，普通文本词不会出现。
 */

export interface WordCloudItem {
  word: string
  count: number
}

export type QuestionId = (typeof QUESTION_IDS)[number]

/** 词云最多返回多少个词（当前目标词仅 12 个，保留上限便于后续扩展） */
const MAX_WORDS = 60

const DICT_FILE = 'domain-words.txt'
const SYNONYMS_FILE = 'synonyms.json'
const TERMS_FILE = 'terms.json'

/** 一个完整的占位符：DW + base36 序号 + X */
const PLACEHOLDER_ONLY = /^DW([0-9A-Z]+)X$/
/** 拆分「占位符与相邻英文粘连」的 token（保留分隔符） */
const PLACEHOLDER_SPLIT = /(DW[0-9A-Z]+X)/

interface Token {
  word: string
  /** true = 由领域词表命中后还原，跳过长/停用词等噪声过滤 */
  fromDict: boolean
}

interface Entry {
  count: number
  first: number
}

function isAscii(value: string): boolean {
  return /^[\x20-\x7E]+$/.test(value)
}

function isPureHan(value: string): boolean {
  return /^[\p{Script=Han}]+$/u.test(value)
}

@Injectable()
export class WordcloudService implements OnModuleInit {
  private readonly logger = new Logger(WordcloudService.name)

  private jieba: Jieba | null = null
  private ready = false

  /** 领域词，长度降序 */
  private domainWords: readonly string[] = []
  /** 首字符（小写）→ 该字符开头的候选词（保持长度降序） */
  private readonly domainIndex = new Map<string, string[]>()
  /** 原词 → 归一目标词 */
  private readonly synonyms = new Map<string, string>()
  /** ASCII 原词小写 → 归一目标词（大小写不敏感兜底） */
  private readonly synonymsLower = new Map<string, string>()
  /** 归一目标词集合 */
  private readonly targetWords = new Set<string>()
  /** 任意写法 → 词条（没有归一目标词时用于显示原词条） */
  private readonly terms = new Map<string, string>()
  /** ASCII 写法小写 → 词条 */
  private readonly termsLower = new Map<string, string>()

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    try {
      this.loadDictionaries()
      this.jieba = Jieba.withDict(dict)
      this.ready = true
      this.logger.log(
        `词云词典加载完成：领域词 ${this.domainWords.length} 个，同义词 ${this.synonyms.size} 条，` +
          `词条映射 ${this.terms.size} 条，目标词 ${this.targetWords.size} 个`,
      )
    } catch (error) {
      this.ready = false
      this.logger.error(
        '词云词典加载失败，词云统计将返回空结果（请检查 domain-words.txt / synonyms.json）',
        error instanceof Error ? error.stack : String(error),
      )
    }
  }

  private loadDictionaries(): void {
    const dir = this.resolveDictDir()
    if (!dir) {
      throw new Error(
        `未找到 ${DICT_FILE} / ${SYNONYMS_FILE}，已尝试目录：${this.candidateDirs().join(' | ')}`,
      )
    }

    const words = readFileSync(join(dir, DICT_FILE), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    this.domainWords = [...new Set(words)].sort(
      (a, b) => b.length - a.length || a.localeCompare(b, 'zh'),
    )

    this.domainIndex.clear()
    for (const word of this.domainWords) {
      const key = word.charAt(0).toLowerCase()
      const bucket = this.domainIndex.get(key)
      if (bucket) bucket.push(word)
      else this.domainIndex.set(key, [word])
    }

    const raw = JSON.parse(readFileSync(join(dir, SYNONYMS_FILE), 'utf8')) as Record<string, string>
    this.synonyms.clear()
    this.synonymsLower.clear()
    this.targetWords.clear()
    for (const [source, target] of Object.entries(raw)) {
      if (!source || !target) continue
      this.synonyms.set(source, target)
      if (isAscii(source)) this.synonymsLower.set(source.toLowerCase(), target)
      this.targetWords.add(target)
    }

    this.loadTerms(dir)
  }

  /** 加载「任意写法 → 词条」映射；文件缺失时降级为「命中的词条原样显示」 */
  private loadTerms(dir: string): void {
    this.terms.clear()
    this.termsLower.clear()

    const path = join(dir, TERMS_FILE)
    if (!existsSync(path)) {
      this.logger.warn(`未找到 ${TERMS_FILE}，无归一目标词的条目将直接显示命中的写法`)
      return
    }

    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>
    for (const [source, term] of Object.entries(raw)) {
      if (!source || !term) continue
      this.terms.set(source, term)
      if (isAscii(source)) this.termsLower.set(source.toLowerCase(), term)
    }
  }

  /** 词典目录候选：编译产物 → src 回落 → cwd 回落 */
  private candidateDirs(): string[] {
    return [
      __dirname,
      resolve(__dirname, '../../src/wordcloud'),
      resolve(process.cwd(), 'src/wordcloud'),
      resolve(process.cwd(), 'dist/wordcloud'),
    ]
  }

  private resolveDictDir(): string | null {
    for (const dir of this.candidateDirs()) {
      if (existsSync(join(dir, DICT_FILE)) && existsSync(join(dir, SYNONYMS_FILE))) {
        return dir
      }
    }
    return null
  }

  /**
   * ① 保护性替换：从左到右扫描，同一位置按长度降序取第一个命中（最长匹配优先）。
   * 命中词替换为 " DW{base36}X "（两侧补空格，避免与相邻英文粘连成一个 token）。
   */
  private protect(text: string): { text: string; words: string[] } {
    if (this.domainWords.length === 0 || text.length === 0) {
      return { text, words: [] }
    }

    const matched: string[] = []
    const lower = text.toLowerCase()
    let output = ''
    let index = 0

    while (index < text.length) {
      const candidates = this.domainIndex.get(lower.charAt(index))
      let hit: string | undefined

      if (candidates) {
        for (const word of candidates) {
          if (index + word.length > text.length) continue
          const same = isAscii(word)
            ? lower.startsWith(word.toLowerCase(), index)
            : text.startsWith(word, index)
          if (same) {
            hit = word
            break
          }
        }
      }

      if (hit) {
        const slot = matched.length.toString(36).toUpperCase()
        matched.push(hit)
        output += ` DW${slot}X `
        index += hit.length
      } else {
        output += text.charAt(index)
        index += 1
      }
    }

    return { text: output, words: matched }
  }

  /** ② jieba 分词 + ③ 还原占位符（含粘连 token 的拆分兜底） */
  private tokenize(text: string, matched: readonly string[]): Token[] {
    if (!this.jieba) return []

    const tokens: Token[] = []
    for (const raw of this.jieba.cutForSearch(text, true)) {
      const token = raw.trim()
      if (!token) continue

      if (!token.includes('DW')) {
        tokens.push({ word: token, fromDict: false })
        continue
      }

      for (const part of token.split(PLACEHOLDER_SPLIT)) {
        const piece = part.trim()
        if (!piece) continue

        const placeholder = PLACEHOLDER_ONLY.exec(piece)
        if (placeholder) {
          const word = matched[parseInt(placeholder[1], 36)]
          if (word) tokens.push({ word, fromDict: true })
          continue
        }

        tokens.push({ word: piece, fromDict: false })
      }
    }

    return tokens
  }

  /**
   * ④ 归一：有归一目标词时用目标词；没有时用原词条（英文写法归到中文词条）。
   * 返回 null 表示不属于词表，不参与词云统计。
   */
  private resolveWord(word: string): string | null {
    const exact = this.synonyms.get(word)
    if (exact) return exact

    if (isAscii(word)) {
      const synonym = this.synonymsLower.get(word.toLowerCase())
      if (synonym) return synonym
    }

    // 没有归一目标词：显示原本词条（terms.json 覆盖「词条」与「英文写法」）
    const term = this.terms.get(word)
    if (term) return term
    if (isAscii(word)) {
      const termLower = this.termsLower.get(word.toLowerCase())
      if (termLower) return termLower
    }

    // terms.json 缺失时的兜底：目标词自身（延续性照护 / 继续教育 / ECHO 没有自映射）
    if (this.targetWords.has(word)) return word
    return null
  }

  /** 普通词的噪声过滤（领域词跳过这一步） */
  private isNoise(word: string): boolean {
    if (/^[\p{P}\p{S}\s]+$/u.test(word)) return true
    if (/^\d+$/.test(word)) return true
    if (isPureHan(word)) return [...word].length < 2
    if (isAscii(word)) {
      return word.length < 2 || STOPWORDS.has(word.toLowerCase())
    }
    return STOPWORDS.has(word)
  }

  /** ⑤ 统计：出现次数累加，count 降序 + 首次出现顺序 → 取前 MAX_WORDS 个 */
  private countAnswersToCloud(answers: readonly string[]): WordCloudItem[] {
    const counters = new Map<string, Entry>()
    let order = 0

    for (const answer of answers) {
      const { text, words } = this.protect(answer)
      for (const token of this.tokenize(text, words)) {
        const word = this.resolveWord(token.word) ?? (token.fromDict ? token.word : null)
        if (!word) continue
        if (!token.fromDict && this.isNoise(token.word)) continue

        const entry = counters.get(word)
        if (entry) {
          entry.count += 1
        } else {
          counters.set(word, { count: 1, first: order })
        }
        order += 1
      }
    }

    return [...counters.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)
      .slice(0, MAX_WORDS)
      .map(([word, entry]) => ({ word, count: entry.count }))
  }

  /** 单问题词云 */
  async computeWordCloud(questionId: string): Promise<WordCloudItem[]> {
    if (!this.ready) return []

    const rows = await this.prisma.answer.findMany({
      where: { questionId, isHidden: false },
      select: { answer: true },
    })
    return this.countAnswersToCloud(rows.map((row) => row.answer))
  }

  /** 八个问题一次性算完，固定返回 q1..q8 八个 key（无数据为 []） */
  async computeAllWordClouds(): Promise<Record<QuestionId, WordCloudItem[]>> {
    const result = {} as Record<QuestionId, WordCloudItem[]>
    for (const id of QUESTION_IDS) result[id] = []

    if (!this.ready) return result

    const rows = await this.prisma.answer.findMany({
      where: { questionId: { in: [...QUESTION_IDS] }, isHidden: false },
      select: { questionId: true, answer: true },
    })

    const grouped = new Map<string, string[]>()
    for (const row of rows) {
      const bucket = grouped.get(row.questionId)
      if (bucket) bucket.push(row.answer)
      else grouped.set(row.questionId, [row.answer])
    }

    for (const id of QUESTION_IDS) {
      result[id] = this.countAnswersToCloud(grouped.get(id) ?? [])
    }
    return result
  }

  /** 该问题的答题总数（前端统计卡片用）；隐藏回答不计入 */
  async countAnswers(questionId: string): Promise<number> {
    return this.prisma.answer.count({ where: { questionId, isHidden: false } })
  }

  /**
   * 参与人数：按 clientIp 去重的答题人数（忽略空 IP）。
   * 注意：现场若共用同一出口 IP（NAT），该数字会偏低。
   */
  async countParticipants(): Promise<number> {
    const rows = await this.prisma.answer.findMany({
      where: { clientIp: { not: null }, isHidden: false },
      select: { clientIp: true },
      distinct: ['clientIp'],
    })
    return rows.length
  }
}
