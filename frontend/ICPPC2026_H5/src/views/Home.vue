<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IDENTITY_OPTIONS, ROUTE_NAMES } from '@/shared/constants'
import type { IdentityTag } from '@/shared/constants'
import { isIdentityTag, loadIdentityTag, saveIdentityTag } from '@/shared/session'

const route = useRoute()
const router = useRouter()

const copy = {
  headerZh: '儿童舒缓安宁大会 · 2026',
  headerEn: 'Paediatric Palliative Care · 2026',
  section: '01 / JOIN · 参与',
  heroZh: '每一份经验，都值得被听见',
  heroEn: 'Every experience deserves to be heard',
  cardZh: '第六届儿童舒缓安宁国际大会（2026）',
  cardEn: '6th International Conference on Paediatric Palliative Care · 2026',
  cardDescZh: '围绕八个问题，分享您的专业经验与家庭视角。',
  cardDescEn:
    'Share professional experience and family perspectives across eight questions.',
  roleZh: '您的参与身份',
  roleEn: 'Your participation role',
  privacyZh: '匿名表达，审核后展示',
  privacyEn: 'Anonymous contribution · Reviewed before display',
  consentZh: '我已了解隐私与审核说明，不提交儿童个人医疗信息。',
  consentEn:
    "I understand the privacy and review policy and will not share a child's personal medical information.",
  ctaZh: '开始参与',
  ctaEn: 'Get started',
  back: '返回',
}

const quickRoles = IDENTITY_OPTIONS.filter(
  (option) => option.value === 'physician' || option.value === 'parent',
)

const selectedRole = ref<IdentityTag>(loadIdentityTag() ?? 'physician')
const consent = ref(true)

const canStart = computed(() => consent.value)

function applyRole(tag: IdentityTag): void {
  selectedRole.value = tag
  if (route.query.from === 'answer') {
    saveIdentityTag(tag)
  }
}

function onSelectRole(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isIdentityTag(value)) {
    applyRole(value)
  }
}

function handleBack(): void {
  router.back()
}

async function handleGetStarted(): Promise<void> {
  if (!consent.value) return
  saveIdentityTag(selectedRole.value)

  const returnQuestionId = route.query.questionId
  if (
    route.query.from === 'answer' &&
    typeof returnQuestionId === 'string' &&
    returnQuestionId.length > 0
  ) {
    // Came from the answer page — swap Home out of history and go straight back.
    await router.replace({
      name: ROUTE_NAMES.Answer,
      params: { questionId: returnQuestionId },
    })
    return
  }

  await router.push({ name: ROUTE_NAMES.Questions })
}
</script>

<template>
  <div class="home">
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
      <p class="section-label">{{ copy.section }}</p>

      <h2 class="hero__zh">{{ copy.heroZh }}</h2>
      <p class="hero__en">{{ copy.heroEn }}</p>

      <section class="card">
        <h3 class="card__zh">{{ copy.cardZh }}</h3>
        <p class="card__en">{{ copy.cardEn }}</p>
        <p class="card__desc-zh">{{ copy.cardDescZh }}</p>
        <p class="card__desc-en">{{ copy.cardDescEn }}</p>
      </section>

      <section class="role">
        <h3 class="role__title">
          <span class="role__zh">{{ copy.roleZh }}</span>
          <span class="role__en">{{ copy.roleEn }}</span>
        </h3>

        <div class="role-select">
          <svg
            class="role-select__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
          </svg>
          <select
            :value="selectedRole"
            class="role-select__field"
            @change="onSelectRole"
          >
            <option
              v-for="option in IDENTITY_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.zh }} · {{ option.en }}
            </option>
          </select>
          <svg
            class="role-select__arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <div class="role-quick">
          <button
            v-for="option in quickRoles"
            :key="option.value"
            type="button"
            class="role-quick__item"
            :class="{ 'role-quick__item--active': selectedRole === option.value }"
            @click="applyRole(option.value)"
          >
            <span class="role-quick__dot" aria-hidden="true"></span>
            <span class="role-quick__zh">{{ option.zh }}</span>
            <span class="role-quick__en">{{ option.en }}</span>
          </button>
        </div>
      </section>

      <section class="privacy">
        <svg
          class="privacy__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <div class="privacy__text">
          <span class="privacy__zh">{{ copy.privacyZh }}</span>
          <span class="privacy__en">{{ copy.privacyEn }}</span>
        </div>
      </section>

      <label class="consent">
        <input v-model="consent" type="checkbox" class="consent__input" />
        <span class="consent__box" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span class="consent__text">
          <span class="consent__zh">{{ copy.consentZh }}</span>
          <span class="consent__en">{{ copy.consentEn }}</span>
        </span>
      </label>
    </main>

    <footer class="footer">
      <button
        type="button"
        class="cta"
        :disabled="!canStart"
        @click="handleGetStarted"
      >
        <span class="cta__zh">{{ copy.ctaZh }}</span>
        <span class="cta__en">{{ copy.ctaEn }}</span>
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

.home {
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
  background: var(--bg);
  color: var(--text-main);
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: calc(env(safe-area-inset-top) + 12px) 16px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
  flex-shrink: 0;
}

.header__back svg {
  width: 22px;
  height: 22px;
}

.header__back:active {
  background: var(--info-bg);
}

.header__titles {
  min-width: 0;
}

.header__zh {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
}

.header__en {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-sub);
  line-height: 1.3;
}

.main {
  flex: 1;
  padding: 22px 20px 28px;
}

.section-label {
  margin: 0 0 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--blue);
}

.hero__zh {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
}

.hero__en {
  margin: 6px 0 0;
  font-size: 15px;
  color: var(--text-sub);
  line-height: 1.4;
}

.card {
  margin-top: 20px;
  padding: 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
}

.card__zh {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.card__en {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-sub);
  line-height: 1.4;
}

.card__desc-zh {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-main);
}

.card__desc-en {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-sub);
}

.role {
  margin-top: 26px;
}

.role__title {
  margin: 0 0 12px;
  display: flex;
  flex-direction: column;
}

.role__zh {
  font-size: 16px;
  font-weight: 600;
}

.role__en {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-sub);
}

.role-select {
  position: relative;
}

.role-select__icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--blue);
  pointer-events: none;
}

.role-select__arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--text-sub);
  pointer-events: none;
}

.role-select__field {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  padding: 14px 44px 14px 42px;
  font: inherit;
  font-size: 16px;
  color: var(--text-main);
  background: var(--surface);
  border: 1.5px solid var(--blue);
  border-radius: 12px;
  cursor: pointer;
}

.role-quick {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.role-quick__item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font: inherit;
  color: var(--text-main);
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
}

.role-quick__item--active {
  border-color: var(--blue);
  background: var(--info-bg);
}

.role-quick__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-strong);
  flex-shrink: 0;
}

.role-quick__item--active .role-quick__dot {
  background: var(--blue);
}

.role-quick__zh {
  font-size: 15px;
  font-weight: 600;
}

.role-quick__en {
  font-size: 12px;
  color: var(--text-sub);
}

.privacy {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 20px;
  padding: 14px;
  background: var(--info-bg);
  border-radius: 12px;
}

.privacy__icon {
  width: 20px;
  height: 20px;
  margin-top: 1px;
  color: var(--blue);
  flex-shrink: 0;
}

.privacy__text {
  display: flex;
  flex-direction: column;
}

.privacy__zh {
  font-size: 14px;
  font-weight: 600;
  color: #1d4ed8;
}

.privacy__en {
  margin-top: 2px;
  font-size: 12px;
  color: #3b5a99;
}

.consent {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 20px;
  cursor: pointer;
}

.consent__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.consent__box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1.5px solid var(--border-strong);
  border-radius: 6px;
  background: var(--surface);
  flex-shrink: 0;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.consent__box svg {
  width: 14px;
  height: 14px;
  color: #ffffff;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.consent__input:checked + .consent__box {
  background: var(--blue);
  border-color: var(--blue);
}

.consent__input:checked + .consent__box svg {
  opacity: 1;
}

.consent__input:focus-visible + .consent__box {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.consent__text {
  display: flex;
  flex-direction: column;
}

.consent__zh {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-main);
}

.consent__en {
  margin-top: 2px;
  font-size: 12px;
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

.cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 16px;
  font: inherit;
  font-size: 17px;
  font-weight: 600;
  color: #ffffff;
  background: var(--blue);
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.cta:active {
  background: #2569c7;
}

.cta:disabled {
  background: #b9d1f5;
  cursor: not-allowed;
}

.cta__en {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}
</style>
