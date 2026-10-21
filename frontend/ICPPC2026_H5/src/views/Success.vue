<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { QUESTION_CARDS, ROUTE_NAMES } from '@/shared/constants'
import { getSubmittedAt } from '@/shared/submitGuard'

const route = useRoute()
const router = useRouter()

const copy = {
  headerZh: '儿童舒缓安宁大会 · 2026',
  headerEn: 'Paediatric Palliative Care · 2026',
  section: '04 / SUBMITTED · 已提交',
  titleZh: '感谢您的分享',
  titleEn: 'Thank you for contributing',
  resultZh: '提交成功',
  resultEn: 'Successfully submitted',
  recapLabelZh: '您已回答',
  recapLabelEn: 'You answered',
  answerZh: '再答一题',
  answerEn: 'Answer another question',
  homeZh: '返回首页',
  homeEn: 'Back to home',
  back: '返回',
} as const

const questionId = computed(() => {
  const raw = route.params.questionId
  return Array.isArray(raw) ? raw[0] : raw
})

const card = computed(() =>
  QUESTION_CARDS.find((item) => item.id === questionId.value),
)

const accent = computed(() => card.value?.color ?? '#2f80ed')

const canView = computed(() => {
  if (!card.value) return false
  return getSubmittedAt(card.value.id) !== null
})

function goQuestions(): void {
  void router.replace({ name: ROUTE_NAMES.Questions })
}

function goHome(): void {
  void router.replace({ name: ROUTE_NAMES.Home })
}

onMounted(() => {
  if (!canView.value) {
    void router.replace({ name: ROUTE_NAMES.Questions })
  }
})
</script>

<template>
  <div
    v-if="card && canView"
    class="success"
    :style="{ '--accent': accent }"
  >
    <header class="header">
      <button
        type="button"
        class="header__back"
        :aria-label="copy.back"
        @click="goQuestions"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div class="header__titles">
        <h1 class="header__zh">{{ copy.headerZh }}</h1>
        <p class="header__en">{{ copy.headerEn }}</p>
      </div>
    </header>

    <main class="main">
      <p class="section-label">{{ copy.section }}</p>

      <h2 class="page-title__zh">{{ copy.titleZh }}</h2>
      <p class="page-title__en">{{ copy.titleEn }}</p>

      <section class="result" role="status" aria-live="polite">
        <div class="check" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path class="check__path" d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p class="result__zh">{{ copy.resultZh }}</p>
        <p class="result__en">{{ copy.resultEn }}</p>
      </section>

      <section class="recap">
        <p class="recap__label">
          <span class="recap__dot" aria-hidden="true"></span>
          <span class="recap__label-zh">{{ copy.recapLabelZh }}</span>
          <span class="recap__sep">/</span>
          <span class="recap__label-en">{{ copy.recapLabelEn }}</span>
        </p>
        <h3 class="recap__title">{{ card.order }}. {{ card.titleZh }}</h3>
        <p class="recap__title-en">{{ card.titleEn }}</p>
      </section>
    </main>

    <footer class="footer">
      <button
        type="button"
        class="footer-btn footer-btn--primary"
        @click="goQuestions"
      >
        <span>{{ copy.answerZh }}</span>
        <span class="footer-btn__en">{{ copy.answerEn }}</span>
      </button>
      <button
        type="button"
        class="footer-btn footer-btn--secondary"
        @click="goHome"
      >
        <span>{{ copy.homeZh }}</span>
        <span class="footer-btn__en">{{ copy.homeEn }}</span>
      </button>
    </footer>
  </div>
</template>

<style scoped>
:global(*),
:global(*::before),
:global(*::after) {
  box-sizing: border-box;
}

:global(html),
:global(body) {
  margin: 0;
  padding: 0;
}

:global(body) {
  background: #f7f9fc;
  color: #1b2437;
  -webkit-tap-highlight-color: transparent;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC',
    'Microsoft YaHei', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.success {
  --blue: #2f80ed;
  --accent: #2f80ed;
  --bg: #f7f9fc;
  --surface: #ffffff;
  --info-bg: #edf4fe;
  --text-main: #1b2437;
  --text-sub: #64748b;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;

  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: 480px;
  margin: 0 auto;
  color: var(--text-main);
  background: var(--bg);
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: calc(env(safe-area-inset-top) + 12px) 20px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  color: var(--text-main);
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.header__back svg {
  width: 22px;
  height: 22px;
}

.header__back:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.header__titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.header__zh {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
}

.header__en {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-sub);
}

.main {
  flex: 1;
  width: 100%;
  padding: 20px 20px 24px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #0c8ce9;
}

.page-title__zh {
  margin: 8px 0 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
}

.page-title__en {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-sub);
}

.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 28px;
  text-align: center;
}

.check {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  color: #277b57;
  background: #ebf6f0;
  border-radius: 50%;
  animation: check-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.check::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  animation: check-ring 0.6s ease-out 0.15s both;
}

.check svg {
  width: 28px;
  height: 28px;
}

.check__path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: check-draw 0.4s ease-out 0.35s forwards;
}

.result__zh {
  margin: 16px 0 0;
  font-size: 18px;
  font-weight: 600;
}

.result__en {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-sub);
}

.recap {
  margin-top: 24px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.recap__label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.recap__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.recap__sep {
  color: var(--border-strong);
}

.recap__label-en {
  font-weight: 500;
}

.recap__title {
  margin: 10px 0 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

.recap__title-en {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-sub);
}

.footer {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 20px calc(env(safe-area-inset-bottom) + 12px);
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 16px;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  border-radius: 14px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.footer-btn--primary {
  color: #ffffff;
  background: var(--blue);
  border: none;
}

.footer-btn--primary:active {
  background: #2569c7;
}

.footer-btn--secondary {
  color: var(--blue);
  background: var(--surface);
  border: 1.5px solid var(--border);
}

.footer-btn--secondary:active {
  background: var(--info-bg);
}

.footer-btn__en {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}

.footer-btn:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

@keyframes check-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes check-ring {
  from {
    box-shadow: 0 0 0 0 rgba(39, 123, 87, 0.25);
  }

  to {
    box-shadow: 0 0 0 14px rgba(39, 123, 87, 0);
  }
}

@keyframes check-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .check,
  .check::after,
  .check__path {
    animation: none;
  }

  .check__path {
    stroke-dashoffset: 0;
  }
}
</style>
