import { AnswersGateway } from '../realtime/answers.gateway'
import { WordcloudScheduler } from './wordcloud.scheduler'
import type { WordcloudService } from './wordcloud.service'

function createDeps() {
  const broadcastWordCloudUpdate = jest.fn()
  const broadcastParticipantCount = jest.fn()
  const computeWordCloud = jest.fn(async (questionId: string) => [
    { word: `word-${questionId}`, count: 1 },
  ])
  const countParticipants = jest.fn(async () => 7)

  const gateway = {
    broadcastWordCloudUpdate,
    broadcastParticipantCount,
  } as unknown as AnswersGateway
  const service = { computeWordCloud, countParticipants } as unknown as WordcloudService
  const scheduler = new WordcloudScheduler(service, gateway)

  return {
    scheduler,
    computeWordCloud,
    countParticipants,
    broadcastWordCloudUpdate,
    broadcastParticipantCount,
  }
}

describe('WordcloudScheduler（词云节流）', () => {
  it('flush 会逐个问题计算并广播，然后清空脏集合', async () => {
    const { scheduler, computeWordCloud, broadcastWordCloudUpdate } = createDeps()

    scheduler.markDirty('q1')
    scheduler.markDirty('q2')
    expect(scheduler.getDirtyQuestions().sort()).toEqual(['q1', 'q2'])

    await scheduler.flush()

    expect(computeWordCloud).toHaveBeenCalledTimes(2)
    expect(broadcastWordCloudUpdate).toHaveBeenCalledWith('q1', [{ word: 'word-q1', count: 1 }])
    expect(broadcastWordCloudUpdate).toHaveBeenCalledWith('q2', [{ word: 'word-q2', count: 1 }])
    expect(scheduler.getDirtyQuestions()).toEqual([])
  })

  it('同一问题多次 markDirty 只计算一次', async () => {
    const { scheduler, computeWordCloud } = createDeps()

    scheduler.markDirty('q1')
    scheduler.markDirty('q1')
    scheduler.markDirty('q1')

    await scheduler.flush()

    expect(computeWordCloud).toHaveBeenCalledTimes(1)
    expect(computeWordCloud).toHaveBeenCalledWith('q1')
  })

  it('flush 期间新标记的问题不会被清掉（下一轮继续处理）', async () => {
    const { scheduler, computeWordCloud } = createDeps()

    computeWordCloud.mockImplementationOnce(async (questionId: string) => {
      // 模拟计算过程中又有答题落库
      scheduler.markDirty('q3')
      return [{ word: `word-${questionId}`, count: 1 }]
    })

    scheduler.markDirty('q1')
    await scheduler.flush()

    expect(scheduler.getDirtyQuestions()).toEqual(['q3'])

    await scheduler.flush()
    expect(computeWordCloud).toHaveBeenLastCalledWith('q3')
    expect(scheduler.getDirtyQuestions()).toEqual([])
  })

  it('单个问题失败不影响其它问题，且不残留脏标记', async () => {
    const { scheduler, computeWordCloud, broadcastWordCloudUpdate } = createDeps()

    computeWordCloud.mockImplementation(async (questionId: string) => {
      if (questionId === 'q1') throw new Error('boom')
      return [{ word: `word-${questionId}`, count: 1 }]
    })

    scheduler.markDirty('q1')
    scheduler.markDirty('q2')

    await expect(scheduler.flush()).resolves.toBeUndefined()

    expect(broadcastWordCloudUpdate).toHaveBeenCalledTimes(1)
    expect(broadcastWordCloudUpdate).toHaveBeenCalledWith('q2', [{ word: 'word-q2', count: 1 }])
    expect(scheduler.getDirtyQuestions()).toEqual([])
  })

  it('脏集合为空时 flush 不调用任何方法', async () => {
    const { scheduler, computeWordCloud, countParticipants, broadcastWordCloudUpdate, broadcastParticipantCount } =
      createDeps()

    await scheduler.flush()

    expect(computeWordCloud).not.toHaveBeenCalled()
    expect(countParticipants).not.toHaveBeenCalled()
    expect(broadcastWordCloudUpdate).not.toHaveBeenCalled()
    expect(broadcastParticipantCount).not.toHaveBeenCalled()
  })

  it('上一轮未结束时再次 flush 直接返回（重入保护）', async () => {
    const { scheduler, computeWordCloud } = createDeps()

    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    computeWordCloud.mockImplementationOnce(async (questionId: string) => {
      await gate
      return [{ word: `word-${questionId}`, count: 1 }]
    })

    scheduler.markDirty('q1')
    const first = scheduler.flush()

    scheduler.markDirty('q2')
    const second = scheduler.flush() // 应直接返回

    release?.()
    await Promise.all([first, second])

    expect(computeWordCloud).toHaveBeenCalledTimes(1)
    expect(scheduler.getDirtyQuestions()).toEqual(['q2'])
  })

  it('有新答题时同时广播参与人数', async () => {
    const { scheduler, countParticipants, broadcastParticipantCount } = createDeps()

    scheduler.markDirty('q1')
    await scheduler.flush()

    expect(countParticipants).toHaveBeenCalledTimes(1)
    expect(broadcastParticipantCount).toHaveBeenCalledWith(7)
  })

  it('参与人数查询失败不影响词云广播', async () => {
    const { scheduler, countParticipants, broadcastWordCloudUpdate, broadcastParticipantCount } =
      createDeps()

    countParticipants.mockImplementation(async () => {
      throw new Error('db down')
    })

    scheduler.markDirty('q1')
    await expect(scheduler.flush()).resolves.toBeUndefined()

    expect(broadcastWordCloudUpdate).toHaveBeenCalledWith('q1', [{ word: 'word-q1', count: 1 }])
    expect(broadcastParticipantCount).not.toHaveBeenCalled()
  })
})
