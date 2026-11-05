import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { AnswersGateway } from '../realtime/answers.gateway'
import { WordcloudService } from './wordcloud.service'

/** 词云刷新/广播节流间隔：同一问题最多 5 秒一次 */
export const WORDCLOUD_INTERVAL_MS = 5000

/**
 * 词云节流调度：
 * 答题落库后只调用 markDirty() 做标记，由 @Interval(5000) 统一重算并广播，
 * 避免每次答题都全量重算词频。
 */
@Injectable()
export class WordcloudScheduler implements OnModuleInit {
  private readonly logger = new Logger(WordcloudScheduler.name)

  /** 待刷新的问题 id */
  private readonly dirtyQuestions = new Set<string>()
  /** 防止上一轮未结束就叠加下一轮 */
  private flushing = false

  constructor(
    private readonly wordcloudService: WordcloudService,
    private readonly gateway: AnswersGateway,
  ) {}

  /** 答题落库后调用：只标记，不重算 */
  markDirty(questionId: string): void {
    this.dirtyQuestions.add(questionId)
  }

  onModuleInit(): void {
    this.logger.log(`词云节流已启动：每 ${WORDCLOUD_INTERVAL_MS}ms 检查一次待刷新问题`)
  }

  /** 当前待刷新的问题（测试 / 排查用） */
  getDirtyQuestions(): string[] {
    return [...this.dirtyQuestions]
  }

  /**
   * 立即刷新一轮：先快照并清空集合，再逐个计算 + 广播。
   * - 计算期间新标记的问题留在集合里，下一轮处理（不会丢）
   * - 单个问题失败只记日志，不影响其它问题
   */
  async flush(): Promise<void> {
    if (this.flushing || this.dirtyQuestions.size === 0) return

    this.flushing = true
    const pending = [...this.dirtyQuestions]
    this.dirtyQuestions.clear()

    try {
      for (const questionId of pending) {
        try {
          const words = await this.wordcloudService.computeWordCloud(questionId)
          this.gateway.broadcastWordCloudUpdate(questionId, words)
        } catch (error) {
          this.logger.error(
            `词云刷新失败：${questionId}`,
            error instanceof Error ? error.stack : String(error),
          )
        }
      }
      this.logger.debug(`词云已刷新并广播：${pending.join(', ')}`)
    } finally {
      this.flushing = false
    }
  }

  /** 每 5 秒消费一次脏集合（集合为空时是 no-op） */
  @Interval(WORDCLOUD_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    await this.flush()
  }
}
