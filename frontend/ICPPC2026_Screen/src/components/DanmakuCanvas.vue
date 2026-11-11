<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const FONT_SIZE = 18
const TRACK_GAP = 14
const SPEED = 120

const canvasRef = ref<HTMLCanvasElement | null>(null)

interface DanmakuItem {
  text: string
  x: number
  y: number
  width: number
}

let ctx: CanvasRenderingContext2D | null = null
let items: DanmakuItem[] = []
let rafId = 0
let lastTs = 0
let width = 0
let height = 0
let dpr = 1
let trackCount = 1
let trackYs: number[] = []
let resizeObserver: ResizeObserver | null = null

const font = () => `${FONT_SIZE}px 'Noto Sans SC', 'Microsoft YaHei', sans-serif`

const measure = (text: string): number => {
  if (!ctx) return 0
  ctx.font = font()
  return ctx.measureText(text).width
}

const layout = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  width = Math.max(1, rect.width)
  height = Math.max(1, rect.height)
  dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)

  const trackHeight = FONT_SIZE + TRACK_GAP
  trackCount = Math.max(1, Math.floor(height / trackHeight))
  trackYs = Array.from({ length: trackCount }, (_, i) => i * trackHeight + FONT_SIZE / 2)
}

const pickTrack = (textWidth: number): number | null => {
  const gap = Math.max(40, textWidth * 0.4)
  const free: number[] = []
  for (let i = 0; i < trackCount; i++) {
    let maxRight = -Infinity
    for (const item of items) {
      if (Math.abs(item.y - trackYs[i]) < 1) {
        maxRight = Math.max(maxRight, item.x + item.width)
      }
    }
    if (maxRight < width - gap) free.push(i)
  }
  if (free.length === 0) return null
  return free[Math.floor(Math.random() * free.length)]
}

const push = (text: string) => {
  const clean = text.trim()
  if (!clean) return
  const textWidth = measure(clean)
  const trackIndex = pickTrack(textWidth)
  if (trackIndex === null) return
  items.push({ text: clean, x: width, y: trackYs[trackIndex], width: textWidth })
}

const tick = (now: number) => {
  const dt = lastTs ? Math.min(0.1, (now - lastTs) / 1000) : 0
  lastTs = now
  if (ctx) {
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#334155'
    ctx.font = font()
    ctx.textBaseline = 'middle'
    items = items.filter((item) => item.x + item.width > 0)
    for (const item of items) {
      item.x -= SPEED * dt
      ctx.fillText(item.text, item.x, item.y)
    }
  }
  rafId = requestAnimationFrame(tick)
}

onMounted(() => {
  layout()
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(() => layout())
    resizeObserver.observe(canvasRef.value)
  }
  lastTs = 0
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  cancelAnimationFrame(rafId)
  items = []
  ctx = null
})

defineExpose({ push })
</script>

<template>
  <canvas ref='canvasRef' class='danmaku-container' />
</template>

<style scoped>
.danmaku-container {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  pointer-events: none;
}
</style>