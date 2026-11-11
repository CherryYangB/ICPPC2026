<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  institutionName: string
  litProvinces: number
  litInstitutions: number
}>()

const emit = defineEmits<{ close: [] }>()

const AUTO_CLOSE_MS = 5000
let closeTimer: number | undefined
/** 每次打开自增，用于重启对勾 / 进度条动画 */
const runId = ref(0)

const clearCloseTimer = () => {
  if (closeTimer !== undefined) {
    window.clearTimeout(closeTimer)
    closeTimer = undefined
  }
}

const requestClose = () => {
  clearCloseTimer()
  emit('close')
}

watch(
  () => props.visible,
  (visible) => {
    clearCloseTimer()
    if (visible) {
      runId.value += 1
      closeTimer = window.setTimeout(() => {
        closeTimer = undefined
        emit('close')
      }, AUTO_CLOSE_MS)
    }
  },
  { immediate: true },
)

onBeforeUnmount(clearCloseTimer)
</script>

<template>
  <Transition name='modal-fade'>
    <div v-if='visible' class='checkin-modal-overlay' @click.stop>
      <div
        :key='runId'
        class='checkin-modal-card'
        role='dialog'
        aria-modal='true'
        aria-labelledby='checkin-modal-title'
        @click.stop
      >
        <button type='button' class='checkin-modal-close' aria-label='关闭' @click='requestClose'>×</button>

        <div class='checkin-check' aria-hidden='true'>
          <svg viewBox='0 0 52 52'>
            <circle class='checkin-check-circle' cx='26' cy='26' r='24' />
            <path class='checkin-check-mark' d='M14 27 L22 35 L38 18' />
          </svg>
        </div>

        <h3 id='checkin-modal-title' class='checkin-modal-title'>打卡成功</h3>
        <p class='checkin-modal-institution'>{{ institutionName }}</p>

        <div class='checkin-modal-stats'>
          <p class='checkin-modal-stat'>已点亮 <strong>{{ litProvinces }}</strong> 个省份</p>
          <p class='checkin-modal-stat'>累计打卡 <strong>{{ litInstitutions }}</strong> 家机构</p>
        </div>

        <div class='checkin-modal-progress'><span class='checkin-modal-progress-bar'></span></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.checkin-modal-overlay {
  position: absolute;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}

.checkin-modal-card {
  position: relative;
  width: 480px;
  padding: 32px 32px 0;
  border: 1px solid var(--line-strong, #E2E8F0);
  border-radius: 12px;
  background: var(--screen-card, #FFFFFF);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  text-align: center;
  overflow: hidden;
}

.checkin-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--screen-text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.checkin-modal-close:hover {
  background: rgba(100, 116, 139, 0.08);
  color: #334155;
}

.checkin-check {
  width: 72px;
  height: 72px;
  margin: 4px auto 10px;
  animation: check-pop 0.35s ease both;
}

.checkin-check svg {
  width: 100%;
  height: 100%;
}

.checkin-check-circle {
  fill: none;
  stroke: rgba(50, 196, 181, 0.35);
  stroke-width: 2;
}

.checkin-check-mark {
  fill: none;
  stroke: #32C4B5;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 42;
  stroke-dashoffset: 42;
  animation: check-draw 0.45s 0.12s ease forwards;
}

@keyframes check-pop {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes check-draw {
  to {
    stroke-dashoffset: 0;
  }
}

.checkin-modal-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
}

.checkin-modal-institution {
  margin: 0 0 16px;
  font-size: 16px;
}

.checkin-modal-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 24px;
  color: var(--screen-text-muted);
  font-size: 14px;
}

.checkin-modal-stat strong {
  color: var(--accent, #4396E8);
  font-size: 16px;
  font-weight: 700;
}

.checkin-modal-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(100, 116, 139, 0.08);
}

.checkin-modal-progress-bar {
  display: block;
  height: 100%;
  background: var(--accent, #4396E8);
  transform-origin: left center;
  animation: modal-progress 5s linear forwards;
}

@keyframes modal-progress {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>