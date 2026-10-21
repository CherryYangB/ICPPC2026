<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { QUESTION_CARDS, QUESTION_PAGE_SIZE, ROUTE_NAMES } from '@/shared/constants'

const router = useRouter()

const copy = {
  headerZh: '儿童舒缓安宁大会 · 2026',
  headerEn: 'Paediatric Palliative Care · 2026',
  sectionPrefix: '02 / EIGHT QUESTIONS · 八问 · ',
  hintZh: '点击问题发表观点 · 演示内容',
  hintEn: 'Select a question · Demo',
  ctaNextZh: '查看第 5–8 问',
  ctaNextEn: 'Questions 5–8',
  ctaPrevZh: '返回第 1–4 问',
  ctaPrevEn: 'Questions 1–4',
  back: '返回',
} as const

const pageCopy = {
  1: {
    titleZh: '选择您想回应的问题',
    titleEn: 'Choose a question to respond to',
  },
  2: {
    titleZh: '让更多视角进入讨论',
    titleEn: 'Bring more perspectives into the conversation',
  },
} as const

const page = ref<1 | 2>(1)

const rangeLabel = computed(() => (page.value === 1 ? '1–4' : '5–8'))

const activeCopy = computed(() => pageCopy[page.value])

const visibleCards = computed(() => {
  const start = (page.value - 1) * QUESTION_PAGE_SIZE
  return QUESTION_CARDS.slice(start, start + QUESTION_PAGE_SIZE)
})

function handleBack(): void {
  router.back()
}

function switchPage(next: 1 | 2): void {
  if (next === page.value) return
  page.value = next
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="questions">
    <header class="header">
      <button
        type="button"
        class="header__back"
        :aria-label="copy.back"
        @click="handleBack"
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
      <p class="section-label">{{ copy.sectionPrefix }}{{ rangeLabel }}</p>

      <h2 class="page-title__zh">{{ activeCopy.titleZh }}</h2>
      <p class="page-title__en">{{ activeCopy.titleEn }}</p>

      <p class="hint">
        <span class="hint__zh">{{ copy.hintZh }}</span>
        <span class="hint__sep">/</span>
        <span class="hint__en">{{ copy.hintEn }}</span>
      </p>

      <ul class="question-list">
        <li v-for="card in visibleCards" :key="card.id">
          <RouterLink
            class="question-card"
            :style="{ '--topic-color': card.color }"
            :to="{ name: ROUTE_NAMES.Answer, params: { questionId: card.id } }"
          >
            <p class="question-card__topic">
              <span class="question-card__dot" aria-hidden="true"></span>
              <span class="question-card__topic-zh">
                {{ card.order }} · {{ card.topicZh }}
              </span>
              <span class="question-card__topic-en">{{ card.topicEn }}</span>
            </p>
            <h3 class="question-card__title-zh">
              {{ card.order }}. {{ card.titleZh }}
            </h3>
            <p class="question-card__title-en">{{ card.titleEn }}</p>
          </RouterLink>
        </li>
      </ul>
    </main>

    <footer class="footer">
      <button
        v-if="page === 1"
        type="button"
        class="footer-btn footer-btn--primary"
        @click="switchPage(2)"
      >
        <span>{{ copy.ctaNextZh }}</span>
        <span class="footer-btn__en">{{ copy.ctaNextEn }}</span>
      </button>
      <button
        v-else
        type="button"
        class="footer-btn footer-btn--secondary"
        @click="switchPage(1)"
      >
        <span>{{ copy.ctaPrevZh }}</span>
        <span class="footer-btn__en">{{ copy.ctaPrevEn }}</span>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.questions {
  --blue: #2f80ed;
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
  padding: 20px 20px 12px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #0c8ce9;
}

.page-title__zh {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
}

.page-title__en {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-sub);
}

.hint {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-muted);
}

.hint__sep {
  margin: 0 6px;
  color: var(--border-strong);
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding: 0;
  list-style: none;
}

.question-card {
  display: block;
  padding: 16px;
  color: inherit;
  text-decoration: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.question-card:hover {
  border-color: var(--border-strong);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.question-card:active {
  transform: scale(0.99);
}

.question-card:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.question-card__topic {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.question-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--topic-color);
  flex-shrink: 0;
}

.question-card__topic-zh {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.question-card__topic-en {
  font-size: 12px;
  color: var(--text-muted);
}

.question-card__title-zh {
  margin: 10px 0 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

.question-card__title-en {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-sub);
}

.footer {
  position: sticky;
  bottom: 0;
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

@media (prefers-reduced-motion: reduce) {
  .question-card,
  .footer-btn {
    transition: none;
  }
}
</style>