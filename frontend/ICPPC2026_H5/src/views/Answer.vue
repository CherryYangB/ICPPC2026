<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IDENTITY_OPTIONS,
  QUESTION_CARDS,
  ROUTE_NAMES,
} from '@/shared/constants'
import type { IdentityTag, QuestionId } from '@/shared/constants'
import { submitAnswer } from '@/shared/api'
import {
  getRemainingCooldown,
  markSubmitted,
} from '@/shared/submitGuard'
import { loadIdentityTag, saveIdentityTag } from '@/shared/session'

const route = useRoute()
const router = useRouter()

const copy = {
  headerZh: '儿童舒缓安宁大会 · 2026',
  headerEn: 'Paediatric Palliative Care · 2026',
  section: '03 / CONTRIBUTE · 发表',
  titleZh: '分享您的观点',
  titleEn: 'Share your perspective',
  viewLabelZh: '您的观点',
  viewLabelEn: 'Your perspective',
  viewPlaceholderZh: '请分享您的观点…',
  viewPlaceholderEn: 'Share your perspective…',
  helperZh: '演示投稿 · 最多 100 字词',
  helperEn: 'Demo post · Max 100 characters',
  identityLabelZh: '您的身份',
  identityLabelEn: 'Your identity',
  privacyZh: '请勿填写儿童姓名、联系方式、病历等个人医疗信息。',
  privacyEn: "Do not include children's names, contact details, medical records or other personal medical information.",
  submitZh: '提交审核',
  submitEn: 'Submit for review',
  submittingZh: '提交中…',
  submittingEn: 'Submitting…',
  back: '返回',
  emptyError: '请先写下您的观点 / Please share your perspective first.',
  failError: '提交失败，请稍后重试 / Submission failed. Please try again.',
} as const

const questionId = computed(() => {
  const raw = route.params.questionId
  return Array.isArray(raw) ? raw[0] : raw
})

const card = computed(() =>
  QUESTION_CARDS.find((item) => item.id === questionId.value),
)

const accent = computed(() => card.value?.color ?? '#2f80ed')
const orderLabel = computed(() =>
  card.value ? String(card.value.order).padStart(2, '0') : '',
)

const answerText = ref('')
const identityTag = ref<IdentityTag>(loadIdentityTag() ?? 'physician')
const submitting = ref(false)
const errorMessage = ref('')
const cooldownRemaining = ref(0)
const keyboardOffset = ref(0)

const textareaRef = ref<HTMLTextAreaElement | null>(null)

let cooldownTimer: number | undefined
let focusTimer: number | undefined

const cooldownMessage = computed(() => {
  const seconds = cooldownRemaining.value
  if (seconds <= 0) return ''
  return `请在 ${seconds} 秒后再提交 / Please wait ${seconds}s before submitting again.`
})

function selectIdentity(tag: IdentityTag): void {
  identityTag.value = tag
  saveIdentityTag(tag)
}

function handleBack(): void {
  if (window.history.state?.back) {
    router.back()
  } else {
    void router.push({ name: ROUTE_NAMES.Questions })
  }
}

function handleTextareaFocus(): void {
  window.clearTimeout(focusTimer)
  focusTimer = window.setTimeout(() => {
    textareaRef.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, 300)
}

function clearError(): void {
  errorMessage.value = ''
}

function syncKeyboardOffset(): void {
  const viewport = window.visualViewport
  keyboardOffset.value = viewport
    ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    : 0
}

function stopCooldown(): void {
  window.clearInterval(cooldownTimer)
  cooldownTimer = undefined
  cooldownRemaining.value = 0
}

function startCooldownCountdown(remainingMs: number, id: QuestionId): void {
  cooldownRemaining.value = Math.ceil(remainingMs / 1000)
  window.clearInterval(cooldownTimer)
  cooldownTimer = window.setInterval(() => {
    const next = getRemainingCooldown(id)
    cooldownRemaining.value = Math.ceil(next / 1000)
    if (next <= 0) {
      stopCooldown()
    }
  }, 1000)
}

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  const id = card.value?.id
  if (!id) return

  const text = answerText.value.trim()
  if (!text) {
    errorMessage.value = copy.emptyError
    return
  }

  const remaining = getRemainingCooldown(id)
  if (remaining > 0) {
    startCooldownCountdown(remaining, id)
    return
  }

  submitting.value = true
  errorMessage.value = ''

  try {
    const result = await submitAnswer({
      questionId: id,
      identityTag: identityTag.value,
      answer: text,
    })
    if (!result.success) {
      throw new Error('Submit failed')
    }
  } catch {
    errorMessage.value = copy.failError
    submitting.value = false
    return
  }

  markSubmitted(id)
  void router.replace({ name: ROUTE_NAMES.Success, params: { questionId: id } })
}

onMounted(() => {
  syncKeyboardOffset()
  window.visualViewport?.addEventListener('resize', syncKeyboardOffset)
  window.visualViewport?.addEventListener('scroll', syncKeyboardOffset)

  if (!card.value) {
    void router.replace({ name: ROUTE_NAMES.Questions })
  }
})

onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', syncKeyboardOffset)
  window.visualViewport?.removeEventListener('scroll', syncKeyboardOffset)
  stopCooldown()
  window.clearTimeout(focusTimer)
})

watch(
  () => route.params.questionId,
  () => {
    if (!card.value) {
      void router.replace({ name: ROUTE_NAMES.Questions })
      return
    }
    answerText.value = ''
    errorMessage.value = ''
    stopCooldown()
  },
)
</script>

<template>
  <div
    class="answer"
    :style="{
      '--accent': accent,
      '--keyboard-offset': keyboardOffset + 'px',
    }"
  >
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

    <main v-if="card" class="main">
      <p class="section-label">{{ copy.section }}</p>

      <h2 class="page-title__zh">{{ copy.titleZh }}</h2>
      <p class="page-title__en">{{ copy.titleEn }}</p>

      <section class="question">
        <p class="question__topic">
          <span class="question__dot" aria-hidden="true"></span>
          <span class="question__topic-zh">{{ orderLabel }} · {{ card.topicZh }}</span>
          <span class="question__topic-en">{{ card.topicEn }}</span>
        </p>
        <h3 class="question__zh">{{ card.titleZh }}</h3>
        <p class="question__en">{{ card.titleEn }}</p>
      </section>

      <section class="identity">
        <p class="field-label">
          <span class="field-label__zh">{{ copy.identityLabelZh }}</span>
          <span class="field-label__en">{{ copy.identityLabelEn }}</span>
        </p>
        <div
          class="identity__scroller"
          role="group"
          :aria-label="`${copy.identityLabelZh} / ${copy.identityLabelEn}`"
        >
          <button
            v-for="option in IDENTITY_OPTIONS"
            :key="option.value"
            type="button"
            class="identity-chip"
            :class="{ 'identity-chip--active': identityTag === option.value }"
            :aria-pressed="identityTag === option.value"
            @click="selectIdentity(option.value)"
          >
            <span class="identity-chip__zh">{{ option.zh }}</span>
            <span class="identity-chip__en">{{ option.en }}</span>
          </button>
        </div>
      </section>

      <section class="field">
        <label class="field-label" for="answer-text">
          <span class="field-label__zh">
            {{ copy.viewLabelZh }}<span class="field-label__req" aria-hidden="true">*</span>
          </span>
          <span class="field-label__en">{{ copy.viewLabelEn }}</span>
        </label>
        <textarea
          id="answer-text"
          ref="textareaRef"
          v-model="answerText"
          class="field__textarea"
          :placeholder="`${copy.viewPlaceholderZh} / ${copy.viewPlaceholderEn}`"
          rows="4"
          maxlength="100"
          aria-required="true"
          @focus="handleTextareaFocus"
          @input="clearError"
        ></textarea>
        <p class="field__helper">
          {{ copy.helperZh }}<span class="field__helper-sep">/</span>{{ copy.helperEn }}
        </p>
      </section>

      <aside class="privacy">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <div class="privacy__text">
          <p class="privacy__zh">{{ copy.privacyZh }}</p>
          <p class="privacy__en">{{ copy.privacyEn }}</p>
        </div>
      </aside>

      <p
        v-if="cooldownMessage"
        class="feedback feedback--status"
        role="status"
        aria-live="polite"
      >
        {{ cooldownMessage }}
      </p>
      <p v-else-if="errorMessage" class="feedback feedback--error" role="alert">
        {{ errorMessage }}
      </p>
    </main>

    <footer v-if="card" class="footer">
      <button
        type="button"
        class="footer-btn"
        :disabled="submitting"
        :aria-busy="submitting"
        @click="handleSubmit"
      >
        <span v-if="submitting">{{ copy.submittingZh }}</span>
        <span v-if="submitting" class="footer-btn__en">{{ copy.submittingEn }}</span>
        <span v-if="!submitting">{{ copy.submitZh }}</span>
        <span v-if="!submitting" class="footer-btn__en">{{ copy.submitEn }}</span>
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

.answer {
  --blue: #2f80ed;
  --accent: #2f80ed;
  --bg: #ffffff;
  --surface: #ffffff;
  --info-bg: #edf4fe;
  --text-main: #1b2437;
  --text-sub: #64748b;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --error-text: #d92d20;
  --error-bg: #fef3f2;
  --error-border: #fecdca;

  display: flex;
  flex-direction: column;
  min-height: 100vh;
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
  background: #ffffff;
  background: color-mix(in srgb, var(--accent) 5%, #ffffff);
  border-bottom: 2px solid var(--accent);
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
  padding: 20px 20px calc(120px + env(safe-area-inset-bottom));
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

.question {
  margin-top: 20px;
}

.question__topic {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.question__dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent);
}

.question__topic-zh {
  font-size: 13px;
  font-weight: 600;
}

.question__topic-en {
  font-size: 12px;
  color: var(--text-muted);
}

.question__zh {
  margin: 10px 0 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
}

.question__en {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-sub);
}

.identity {
  margin-top: 18px;
}

.field-label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.field-label__en {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.field-label__req {
  margin-left: 2px;
  color: var(--blue);
}

.identity__scroller {
  display: flex;
  gap: 8px;
  margin: 8px -20px 0;
  padding: 2px 20px 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  overscroll-behavior-x: contain;
}

.identity__scroller::-webkit-scrollbar {
  display: none;
}

.identity-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  flex: 0 0 auto;
  white-space: nowrap;
  scroll-snap-align: start;
  padding: 8px 13px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  background: #ffffff;
  border: 1.5px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease;
}

.identity-chip__en {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
}

.identity-chip--active {
  border-color: var(--accent);
  background: #f4f8fd;
  background: color-mix(in srgb, var(--accent) 12%, #ffffff);
}

.identity-chip:active {
  transform: scale(0.97);
}

.identity-chip:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
.field {
  margin-top: 18px;
}

.field__textarea {
  display: block;
  width: 100%;
  min-height: 120px;
  margin-top: 8px;
  padding: 12px 14px;
  font: inherit;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-main);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  resize: none;
  scroll-margin-block: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.field__textarea::placeholder {
  color: var(--text-muted);
}

.field__textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow:
    0 0 0 1px var(--accent),
    0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent);
}

.field__helper {
  margin: 6px 0 0;
  font-size: 12px;
  text-align: center;
  color: var(--text-muted);
}

.field__helper-sep {
  margin: 0 6px;
  color: var(--border-strong);
}

.privacy {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 18px;
  padding: 12px 14px;
  background: var(--info-bg);
  border-radius: 12px;
}

.privacy svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--blue);
}

.privacy__text p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-sub);
}

.privacy__text p + p {
  margin-top: 2px;
}

.feedback {
  margin: 14px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.5;
  border-radius: 10px;
}

.feedback--status {
  color: var(--blue);
  background: var(--info-bg);
  border: 1px solid #cfe2fb;
}

.feedback--error {
  color: var(--error-text);
  background: var(--error-bg);
  border: 1px solid var(--error-border);
}

.footer {
  position: fixed;
  left: 50%;
  bottom: var(--keyboard-offset, 0px);
  z-index: 20;
  width: 100%;
  max-width: 480px;
  transform: translateX(-50%);
  padding: 12px 20px calc(env(safe-area-inset-bottom) + 12px);
  background: var(--surface);
  box-shadow: 0 -1px 0 var(--border);
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
  color: #ffffff;
  background: var(--blue);
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.footer-btn:active {
  background: #2569c7;
}

.footer-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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
  .identity-chip,
  .field__textarea,
  .footer-btn {
    transition: none;
  }
}
</style>
