<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useSocket } from '@/composables/useSocket'
import { ROUTE_PATHS } from '@/shared/constants'
import {
  fetchParticipantCount,
  fetchQrInfo,
  fetchQuestionCount,
  fetchQuestions,
  fetchRecentAnswers,
  fetchWordCloud,
  fetchWordClouds,
} from '@/shared/api'
import type {
  AnswerDeletedEvent,
  AnswerHiddenEvent,
  NewAnswerEvent,
  ParticipantCountEvent,
  Question,
  WordCloudMap,
  WordCloudUpdateEvent,
} from '@/types/quiz'
import DanmakuCanvas from '@/components/DanmakuCanvas.vue'
import WordCloudChart from '@/components/WordCloudChart.vue'
import qrFallback from '@/assets/qr-participate.jpg'

const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

const questions = ref<Question[]>([])
const selectedId = ref('')
const wordCloudCache = ref<WordCloudMap>({})
const counts = ref<Record<string, number>>({})
const currentCount = ref(0)
const totalCount = ref(0)
const participantCount = ref(0)

/** 二维码优先使用后端上传版本，失败时回退到打包资源 */
const qrImage = ref(qrFallback)

const loadQrImage = async () => {
  try {
    const info = await fetchQrInfo()
    if (info.url) qrImage.value = info.url
  } catch (error) {
    console.warn('[Interactive] Failed to load QR info, using bundled fallback', error)
  }
}

const handleQrImageError = () => {
  qrImage.value = qrFallback
}

const danmakuRef = ref<{ push: (text: string) => void } | null>(null)

interface DanmakuQueueItem {
  answerId: string
  answer: string
}

const danmakuQueue = ref<DanmakuQueueItem[]>([])
let danmakuTimer: number | undefined
let danmakuIndex = 0

const DANMAKU_GAP_MIN = 1200
const DANMAKU_GAP_MAX = 2600
const DANMAKU_LOOP_PAUSE = 2000

const scheduleNextDanmaku = () => {
  const queue = danmakuQueue.value
  if (queue.length === 0) {
    return
  }
  danmakuRef.value?.push(queue[danmakuIndex % queue.length].answer)
  danmakuIndex += 1

  const gap = danmakuIndex % queue.length === 0
    ? DANMAKU_LOOP_PAUSE
    : DANMAKU_GAP_MIN + Math.random() * (DANMAKU_GAP_MAX - DANMAKU_GAP_MIN)

  danmakuTimer = window.setTimeout(scheduleNextDanmaku, gap)
}

const startDanmakuLoop = (items: DanmakuQueueItem[]) => {
  if (danmakuTimer !== undefined) {
    window.clearTimeout(danmakuTimer)
    danmakuTimer = undefined
  }
  danmakuQueue.value = items.filter((item) => item.answer.trim())
  danmakuIndex = 0
  scheduleNextDanmaku()
}

const { connected, on } = useSocket()
const hasDisconnected = ref(false)

const scale = ref(Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT))
const updateScale = () => {
  scale.value = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT)
}
const handleResize = () => updateScale()

// 八问无需切换：把所有问题的词频合并到同一个词云
const wordCloudData = computed(() => {
  const merged = new Map<string, number>()
  for (const words of Object.values(wordCloudCache.value)) {
    for (const item of words) {
      merged.set(item.word, (merged.get(item.word) ?? 0) + item.count)
    }
  }
  return [...merged.entries()].map(([word, count]) => ({
    name: word,
    value: [...word].length > 8 ? count * 0.7 : count,
  }))
})

const loadCounts = async () => {
  const results = await Promise.allSettled(questions.value.map((q) => fetchQuestionCount(q.id)))
  let total = 0
  results.forEach((result, index) => {
    const id = questions.value[index].id
    const count = result.status === 'fulfilled' ? result.value : 0
    counts.value[id] = count
    total += count
  })
  totalCount.value = total
  currentCount.value = counts.value[selectedId.value] ?? 0
}

const refreshWordClouds = async () => {
  try {
    const clouds = await fetchWordClouds()
    wordCloudCache.value = clouds
  } catch (error) {
    console.error('[Interactive] Failed to refresh wordclouds', error)
  }

  try {
    participantCount.value = await fetchParticipantCount()
  } catch (error) {
    console.error('[Interactive] Failed to refresh participant count', error)
  }
}

const selectQuestion = async (id: string) => {
  selectedId.value = id
  currentCount.value = counts.value[id] ?? 0
  try {
    const [words, count] = await Promise.all([fetchWordCloud(id), fetchQuestionCount(id)])
    wordCloudCache.value = { ...wordCloudCache.value, [id]: words }
    counts.value = { ...counts.value, [id]: count }
    if (selectedId.value === id) currentCount.value = count
  } catch (error) {
    console.error('[Interactive] Failed to load question', error)
  }
}

const loadInit = async () => {
  try {
    const [qs, clouds] = await Promise.all([fetchQuestions(), fetchWordClouds()])
    questions.value = qs
    wordCloudCache.value = clouds
    selectedId.value = qs[0]?.id ?? ''
    await loadCounts()
  } catch (error) {
    console.error('[Interactive] Failed to load', error)
  }

  try {
    participantCount.value = await fetchParticipantCount()
  } catch (error) {
    console.error('[Interactive] Failed to load participant count', error)
  }

  // 弹幕回放：错落 + 循环
  try {
    const recent = await fetchRecentAnswers(20)
    startDanmakuLoop(
      recent.map((item) => ({ answerId: item.answerId, answer: item.answer })),
    )
  } catch (error) {
    console.error('[Interactive] Failed to seed danmaku', error)
  }
}

on('newAnswer', (payload: NewAnswerEvent) => {
  if (payload.answer.trim()) {
    danmakuRef.value?.push(payload.answer)
  }
  counts.value[payload.questionId] = (counts.value[payload.questionId] ?? 0) + 1
  totalCount.value += 1
  if (payload.questionId === selectedId.value) currentCount.value += 1
})

on('wordCloudUpdate', (payload: WordCloudUpdateEvent) => {
  wordCloudCache.value = { ...wordCloudCache.value, [payload.questionId]: payload.words }
})

on('participantCount', (payload: ParticipantCountEvent) => {
  participantCount.value = payload.count
})

/** 后台隐藏 / 删除回答：从弹幕回放队列移除，并重新同步计数与词云 */
const handleAnswerRemoved = (answerId: string) => {
  danmakuQueue.value = danmakuQueue.value.filter((item) => item.answerId !== answerId)
  if (danmakuQueue.value.length === 0) {
    danmakuIndex = 0
    if (danmakuTimer !== undefined) {
      window.clearTimeout(danmakuTimer)
      danmakuTimer = undefined
    }
  }
  void loadCounts()
  void refreshWordClouds()
}

on('answerHidden', (payload: AnswerHiddenEvent) => {
  handleAnswerRemoved(payload.answerId)
})

on('answerDeleted', (payload: AnswerDeletedEvent) => {
  handleAnswerRemoved(payload.answerId)
})

watch(connected, (value, oldValue) => {
  if (!value && oldValue) hasDisconnected.value = true
  if (value && !oldValue && hasDisconnected.value) {
    hasDisconnected.value = false
    void refreshWordClouds()
  }
})

onMounted(() => {
  updateScale()
  window.addEventListener('resize', handleResize)
  void loadInit()
  void loadQrImage()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (danmakuTimer !== undefined) {
    window.clearTimeout(danmakuTimer)
    danmakuTimer = undefined
  }
})

defineExpose({ selectQuestion, currentCount, totalCount, participantCount })
</script>

<template>
  <div class='screen-viewport'>
    <div class='screen-stage' :style='{ transform: `translate(-50%, -50%) scale(${scale})` }'>
      <div class='interactive-page'>
        <p v-if='hasDisconnected && !connected' class='reconnect-banner'>连接中断，正在重连</p>

        <header class='page-header'>
          <div class='conference-identity'>
            <h1 class='conference-name'>第六届儿童舒缓安宁国际交流大会（2026）</h1>
            <p class='conference-name-en'>6th International Conference on Paediatric Palliative Care · 2026</p>
          </div>
          <nav class='display-nav' aria-label='大屏导航'>
            <span class='nav-pill'>大会总览 / Overview</span>
            <RouterLink class='nav-pill is-active' :to='ROUTE_PATHS.Interactive'>八问聚合 / Eight questions</RouterLink>
            <RouterLink class='nav-pill' :to='ROUTE_PATHS.ResourceMap'>资源地图 / Resource map</RouterLink>
          </nav>
        </header>

        <section class='content-heading'>
          <h2 class='heading-zh'>八问观点聚合</h2>
          <p class='heading-en'>Eight questions · Shared perspectives</p>
        </section>

        <main class='content-grid'>
          <section class='left-column'>
            <div class='wordcloud-card'>
              <WordCloudChart class='wordcloud-canvas' :data='wordCloudData' />
            </div>

            <div class='qr-card'>
              <div class='qr-copy'>
                <h3 class='qr-title'>扫码参与</h3>
                <p class='qr-subtitle-en'>Scan to participate</p>
                <p class='qr-body'>扫码提交观点，参与儿童舒缓疗护标准讨论</p>
                <p class='qr-body-en'>Scan to submit your thoughts and join the discussion</p>
              </div>
              <img
                class='qr-image'
                :src='qrImage'
                alt='扫码参与二维码'
                @error='handleQrImageError'
              />
            </div>
          </section>

          <section class='response-wall'>
            <DanmakuCanvas ref='danmakuRef' class='danmaku-layer' />
          </section>
        </main>

        <footer class='page-footer'>
          数据实时更新，仅展示审核通过的观点。 / Live data · Approved perspectives only.
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.screen-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #F8FBFF;
}

.screen-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1920px;
  height: 1080px;
  transform-origin: center center;
}

.interactive-page {
  position: relative;
  width: 100%;
  height: 100%;
  background: #F8FBFF;
  color: #334155;
  font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
}

.reconnect-banner {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 30;
  margin: 0;
  padding: 8px 14px;
  border: 1px solid rgba(232, 88, 104, 0.5);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  color: #E85868;
  font-size: 13px;
}

.page-header {
  position: absolute;
  top: 40px;
  left: 40px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 1840px;
  height: 80px;
}

.conference-name {
  margin: 0;
  color: #4396E8;
  font-size: 30px;
  font-weight: 700;
  line-height: 36px;
}

.conference-name-en {
  margin: 8px 0 0;
  font-family: Inter, 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  font-size: 17px;
  line-height: 20.6px;
  color: #64748B;
}

.display-nav {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.nav-pill {
  display: inline-flex;
  align-items: center;
  height: 43px;
  padding: 0 20px;
  border-radius: 6px;
  background: #FFFFFF;
  color: #64748B;
  font-size: 16px;
  line-height: 19.2px;
  white-space: nowrap;
}

.nav-pill.is-active {
  background: #4396E8;
  color: #ffffff;
}

.content-heading {
  position: absolute;
  top: 152px;
  left: 40px;
  width: 1840px;
}

.heading-zh {
  margin: 0;
  font-size: 26px;
  font-weight: 500;
  line-height: 36.4px;
}

.heading-en {
  margin: 4px 0 0;
  font-family: Inter, 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  line-height: 22.4px;
  color: #64748B;
}

.content-grid {
  position: absolute;
  top: 237px;
  left: 40px;
  display: flex;
  gap: 24px;
  width: 1840px;
  height: 787px;
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 640px;
  height: 787px;
}

.wordcloud-card {
  position: relative;
  width: 640px;
  height: 440.4px;
  border: 1px dashed #E2E8F0;
  border-radius: 12px;
  background: #FFFFFF;
  overflow: hidden;
}

.wordcloud-canvas {
  position: absolute;
  inset: 0;
}

.qr-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 640px;
  height: 273.6px;
  padding: 24px;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  background: #FFFFFF;
}

.qr-copy {
  max-width: 400px;
}

.qr-title {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  line-height: 21.6px;
}

.qr-subtitle-en {
  margin: 4px 0 0;
  font-family: Inter, 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  line-height: 15.7px;
  color: #64748B;
}

.qr-body {
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 19.6px;
  color: #64748B;
}

.qr-body-en {
  margin: 12px 0 0;
  font-family: Inter, 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  line-height: 16.8px;
  color: #64748B;
}

.qr-image {
  flex: 0 0 auto;
  width: 152px;
  height: 152px;
}

.response-wall {
  position: relative;
  flex: 1;
  height: 787px;
  border: 1px dashed #E2E8F0;
  border-radius: 12px;
  background: #FFFFFF;
  overflow: hidden;
}

.danmaku-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.page-footer {
  position: absolute;
  top: 1024px;
  left: 40px;
  width: 1840px;
  margin: 0;
  font-size: 13px;
  line-height: 15.6px;
  color: #64748B;
}
</style>