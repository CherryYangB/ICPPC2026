<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createEngine, type DanmakuEngine, type DanmakuItem } from 'danmaku-lite'

const FONT_SIZE = 24
const TRACK_HEIGHT = 48
const MAX_TRACKS = 8

const containerRef = ref<HTMLDivElement | null>(null)
let engine: DanmakuEngine | null = null
let seq = 0
const startedAt = performance.now()

onMounted(() => {
  const container = containerRef.value
  if (!container) {
    return
  }
  const height = container.clientHeight || 1
  const area = Math.min(0.9, Math.max(0.2, (MAX_TRACKS * TRACK_HEIGHT) / height))

  engine = createEngine('canvas', {
    container,
    adapter: {
      get position() {
        return (performance.now() - startedAt) / 1000
      },
      get paused() {
        return false
      },
    },
    fps: 60,
    area,
    speed: 1,
    fontFamily: "'Inter', 'Noto Sans SC', 'Microsoft YaHei', sans-serif",
    fontSize: FONT_SIZE,
    fontWeight: '400',
    opacity: 1,
    padding: 8,
    strokeColor: 0x000000,
    strokeWidth: 0,
  })
})

const push = (text: string) => {
  engine?.send({
    id: ++seq,
    text,
    time: 0,
    mode: 1,
    color: 0xf9f2e9,
    font_size: FONT_SIZE,
  } as DanmakuItem)
}

onBeforeUnmount(() => {
  engine?.destroy()
  engine = null
})

defineExpose({ push })
</script>

<template>
  <div ref='containerRef' class='danmaku-container' />
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