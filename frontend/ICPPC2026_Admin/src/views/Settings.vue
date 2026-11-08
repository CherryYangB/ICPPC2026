<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// 系统设置三个标签（占位名称，后续按业务调整）
const TABS = [
  { key: 'general', label: '基本设置' },
  { key: 'security', label: '安全设置' },
  { key: 'notification', label: '通知设置' },
] as const

type TabKey = (typeof TABS)[number]['key']

const route = useRoute()

const activeTab = computed<TabKey>(() => {
  const key = route.query.tab
  return TABS.some((tab) => tab.key === key) ? (key as TabKey) : TABS[0].key
})
</script>

<template>
  <div class="settings-page">
    <div class="tabs">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.key"
        :to="{ path: '/settings', query: { tab: tab.key } }"
        :class="{ active: activeTab === tab.key }"
      >
        {{ tab.label }}
      </RouterLink>
    </div>
    <div class="tab-panel">系统设置 · {{ activeTab }} 占位</div>
  </div>
</template>
