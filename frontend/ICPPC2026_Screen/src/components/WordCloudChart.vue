<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import '@modernized/echarts-wordcloud'

interface WordCloudItem {
  name: string
  value: number
}

const props = defineProps<{
  data: WordCloudItem[]
  color: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const buildOption = () => ({
  animationDurationUpdate: 500,
  series: [
    {
      type: 'wordCloud',
      shape: 'circle',
      left: 'center',
      top: 'center',
      width: '100%',
      height: '100%',
      sizeRange: [18, 80],
      rotationRange: [0, 0],
      textStyle: {
        color: () => props.color,
        fontFamily: 'Noto Sans SC',
      },
      data: props.data,
    },
  ],
})

const render = () => {
  chart?.setOption(buildOption() as unknown as echarts.EChartsOption)
}

onMounted(() => {
  const container = containerRef.value
  if (!container) {
    return
  }
  chart = echarts.init(container)
  render()
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(container)
})

watch(
  () => [props.data, props.color],
  () => render(),
  { deep: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref='containerRef' class='word-cloud-chart' />
</template>

<style scoped>
.word-cloud-chart {
  width: 100%;
  height: 100%;
}
</style>