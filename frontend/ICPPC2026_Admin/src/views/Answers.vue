<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Bilingual } from '@/stores/ui'
import {
  batchDelete,
  batchHide,
  deleteAnswer,
  fetchAnswers,
  setAnswerVisibility,
  updateAnswer,
} from '@/api/answer'
import { fetchQuestions } from '@/api/question'
import { IDENTITY_LABELS, IDENTITY_TAGS } from '@/types/answer'
import type { AdminAnswer, IdentityTag, QueryAdminAnswers } from '@/types/answer'
import { FALLBACK_QUESTIONS } from '@/types/question'
import type { Question } from '@/types/question'

const authStore = useAuthStore()
const ui = useUiStore()

const t = (label: Bilingual): string => ui.primary(label)
const s = (label: Bilingual): string => ui.secondary(label)

const canWrite = computed(
  () => authStore.user?.role === 'super_admin' || authStore.user?.role === 'admin',
)

// ---- 文案 ----
const L = {
  filterQuestion: { zh: '题目', en: 'Question' },
  filterIdentity: { zh: '身份', en: 'Identity' },
  filterStatus: { zh: '状态', en: 'Status' },
  allQuestions: { zh: '全部题目', en: 'All questions' },
  allIdentities: { zh: '全部身份', en: 'All identities' },
  allStatus: { zh: '全部状态', en: 'All status' },
  visible: { zh: '显示中', en: 'Displaying' },
  hidden: { zh: '已隐藏', en: 'Hidden' },
  keywordPlaceholder: { zh: '搜索回答内容', en: 'Search answers' },
  search: { zh: '搜索', en: 'Search' },
  reset: { zh: '重置', en: 'Reset' },
  batchHide: { zh: '批量隐藏', en: 'Hide selected' },
  batchDelete: { zh: '批量删除', en: 'Delete selected' },
  colTime: { zh: '提交时间', en: 'Submitted' },
  colQuestion: { zh: '题目', en: 'Question' },
  colIdentity: { zh: '身份', en: 'Identity' },
  colAnswer: { zh: '回答内容', en: 'Answer' },
  colDisplay: { zh: '显示', en: 'Display' },
  colActions: { zh: '操作', en: 'Actions' },
  edit: { zh: '编辑', en: 'Edit' },
  delete: { zh: '删除', en: 'Delete' },
  prev: { zh: '上一页', en: 'Previous' },
  next: { zh: '下一页', en: 'Next' },
  today: { zh: '今天', en: 'Today' },
  yesterday: { zh: '昨天', en: 'Yesterday' },
  empty: { zh: '暂无数据', en: 'No data' },
  save: { zh: '保存', en: 'Save' },
  cancel: { zh: '取消', en: 'Cancel' },
  confirmDeleteTitle: { zh: '删除回答', en: 'Delete answer' },
  confirmDeleteText: { zh: '确定删除这条回答吗？删除后大屏将同步移除。', en: 'Delete this answer? It will be removed from the screen.' },
  confirmBatchDeleteTitle: { zh: '批量删除回答', en: 'Delete selected answers' },
  confirmBatchDeleteText: { zh: '确定删除选中的回答吗？此操作不可恢复。', en: 'Delete the selected answers? This cannot be undone.' },
  editTitle: { zh: '编辑回答', en: 'Edit answer' },
  editPlaceholder: { zh: '请输入回答内容（1-100 字）', en: 'Answer content (1-100 chars)' },
  perPage: { zh: '每页 20 条', en: '20 per page' },
  scrollHint: { zh: '表格可滚动查看本页其余回答', en: 'Scroll to view more answers on this page' },
} as const
// ---- 数据 ----
const questions = ref<Question[]>([])
const questionMap = computed(() => new Map(questions.value.map((q) => [q.id, q])))

const questionFilter = ref('')
const identityFilter = ref('')
const statusFilter = ref('') // '' | 'visible' | 'hidden'
const keyword = ref('')
const keywordInput = ref('')

const page = ref(1)
const pageSize = 20
const total = ref(0)
const totalPages = ref(0)
const items = ref<AdminAnswer[]>([])
const loading = ref(false)
const errorMessage = ref('')

const selectedIds = ref<string[]>([])

// 编辑弹窗
const editing = ref<AdminAnswer | null>(null)
const editingText = ref('')
const savingEdit = ref(false)

// 删除弹窗
const deleting = ref<AdminAnswer | null>(null)
const deletingBusy = ref(false)

// 批量删除弹窗
const batchDeleting = ref(false)
const batchDeleteBusy = ref(false)

const allSelected = computed(
  () => items.value.length > 0 && items.value.every((a) => selectedIds.value.includes(a.id)),
)

function questionLabel(q: Question): string {
  return `${q.id} · ${q.topicZh}`
}

function identityName(tag: string): { zh: string; en: string } {
  return IDENTITY_LABELS[tag as IdentityTag] ?? { zh: tag, en: tag }
}

function questionColor(questionId: string): string {
  return questionMap.value.get(questionId)?.color ?? '#2f80ed'
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function relativeDay(iso: string): Bilingual | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return L.today
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return L.yesterday
  return null
}

function relativeText(iso: string): string {
  const rel = relativeDay(iso)
  return rel ? t(rel) : ''
}

function readError(err: unknown): string {
  const data = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
  const message = data?.message
  if (typeof message === 'string' && message.trim()) return message
  if (Array.isArray(message) && message.length > 0) return message.filter(Boolean).join('；')
  return '请求失败，请稍后重试'
}
async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const params: QueryAdminAnswers = { page: page.value, pageSize }
    if (questionFilter.value) params.questionId = questionFilter.value
    if (identityFilter.value) params.identityTag = identityFilter.value
    if (statusFilter.value === 'visible') params.isHidden = false
    if (statusFilter.value === 'hidden') params.isHidden = true
    if (keyword.value.trim()) params.keyword = keyword.value.trim()

    const data = await fetchAnswers(params)
    items.value = data.items
    total.value = data.total
    totalPages.value = data.totalPages
    selectedIds.value = []
  } catch (err) {
    errorMessage.value = readError(err)
  } finally {
    loading.value = false
  }
}

function applySearch(): void {
  keyword.value = keywordInput.value.trim()
  page.value = 1
  void load()
}

function resetFilters(): void {
  questionFilter.value = ''
  identityFilter.value = ''
  statusFilter.value = ''
  keyword.value = ''
  keywordInput.value = ''
  page.value = 1
  void load()
}

function goPage(p: number): void {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  void load()
}

function toggleSelect(id: string): void {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(id)
}

function toggleSelectAll(): void {
  selectedIds.value = allSelected.value ? [] : items.value.map((a) => a.id)
}

async function toggleVisibility(row: AdminAnswer): Promise<void> {
  if (!canWrite.value) return
  try {
    const updated = await setAnswerVisibility(row.id, !row.isHidden)
    row.isHidden = updated.isHidden
  } catch (err) {
    errorMessage.value = readError(err)
  }
}

function openEdit(row: AdminAnswer): void {
  if (!canWrite.value) return
  editing.value = row
  editingText.value = row.answer
}

function closeEdit(): void {
  editing.value = null
  editingText.value = ''
}

async function saveEdit(): Promise<void> {
  if (!editing.value) return
  const text = editingText.value.trim()
  if (!text) {
    errorMessage.value = '回答内容不能为空'
    return
  }
  savingEdit.value = true
  try {
    const updated = await updateAnswer(editing.value.id, text)
    const index = items.value.findIndex((a) => a.id === updated.id)
    if (index >= 0) items.value[index].answer = updated.answer
    closeEdit()
  } catch (err) {
    errorMessage.value = readError(err)
  } finally {
    savingEdit.value = false
  }
}

function askDelete(row: AdminAnswer): void {
  if (canWrite.value) deleting.value = row
}

async function doDelete(): Promise<void> {
  if (!deleting.value) return
  deletingBusy.value = true
  try {
    await deleteAnswer(deleting.value.id)
    deleting.value = null
    await load()
  } catch (err) {
    errorMessage.value = readError(err)
  } finally {
    deletingBusy.value = false
  }
}

async function doBatchHide(): Promise<void> {
  if (!selectedIds.value.length) return
  try {
    await batchHide(selectedIds.value)
    await load()
  } catch (err) {
    errorMessage.value = readError(err)
  }
}

async function doBatchDelete(): Promise<void> {
  batchDeleteBusy.value = true
  try {
    await batchDelete(selectedIds.value)
    batchDeleting.value = false
    await load()
  } catch (err) {
    errorMessage.value = readError(err)
  } finally {
    batchDeleteBusy.value = false
  }
}

onMounted(async () => {
  try {
    questions.value = await fetchQuestions()
  } catch {
    questions.value = FALLBACK_QUESTIONS
  }
  await load()
})
</script>

<template>
<div class="answers-page">
  <!-- 筛选栏 -->
  <div class="filter-bar">
    <select v-model="questionFilter" class="control" @change="page = 1; load()">
      <option value="">{{ t(L.allQuestions) }}</option>
      <option v-for="q in questions" :key="q.id" :value="q.id">{{ questionLabel(q) }}</option>
    </select>
    <select v-model="identityFilter" class="control" @change="page = 1; load()">
      <option value="">{{ t(L.allIdentities) }}</option>
      <option v-for="tag in IDENTITY_TAGS" :key="tag" :value="tag">{{ identityName(tag).zh }}</option>
    </select>
    <select v-model="statusFilter" class="control" @change="page = 1; load()">
      <option value="">{{ t(L.allStatus) }}</option>
      <option value="visible">{{ t(L.visible) }}</option>
      <option value="hidden">{{ t(L.hidden) }}</option>
    </select>
    <input v-model="keywordInput" class="search-input" :placeholder="t(L.keywordPlaceholder)" @keyup.enter="applySearch" />
    <button class="btn btn-primary" @click="applySearch">{{ t(L.search) }}</button>
    <button class="btn" @click="resetFilters">{{ t(L.reset) }}</button>
  </div>

  <!-- 批量工具栏 -->
  <div v-if="canWrite" class="toolbar">
    <span v-if="selectedIds.length" class="selected-info">{{ selectedIds.length }} 已选</span>
    <button class="btn" :disabled="!selectedIds.length" @click="doBatchHide">{{ t(L.batchHide) }}</button>
    <button class="btn btn-danger" :disabled="!selectedIds.length" @click="batchDeleting = true">{{ t(L.batchDelete) }}</button>
  </div>

  <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

  <!-- 表格 -->
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th class="col-check"><input type="checkbox" :checked="allSelected" @change="toggleSelectAll" /></th>
          <th class="col-time">{{ t(L.colTime) }}<span class="sub">{{ s(L.colTime) }}</span></th>
          <th class="col-question">{{ t(L.colQuestion) }}<span class="sub">{{ s(L.colQuestion) }}</span></th>
          <th class="col-identity">{{ t(L.colIdentity) }}<span class="sub">{{ s(L.colIdentity) }}</span></th>
          <th class="col-answer">{{ t(L.colAnswer) }}<span class="sub">{{ s(L.colAnswer) }}</span></th>
          <th class="col-display">{{ t(L.colDisplay) }}<span class="sub">{{ s(L.colDisplay) }}</span></th>
          <th class="col-actions">{{ t(L.colActions) }}<span class="sub">{{ s(L.colActions) }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="7" class="cell-loading">加载中…</td>
        </tr>
        <tr v-else-if="!items.length">
          <td colspan="7" class="cell-loading">{{ t(L.empty) }}</td>
        </tr>
        <tr v-for="row in items" :key="row.id" class="answer-row">
          <td class="col-check"><input type="checkbox" :checked="selectedIds.includes(row.id)" @change="toggleSelect(row.id)" /></td>
          <td class="col-time">
            <div class="primary-text">{{ formatDateTime(row.createdAt) }}</div>
            <div v-if="relativeText(row.createdAt)" class="sub">{{ relativeText(row.createdAt) }}</div>
          </td>
          <td class="col-question">
            <span class="tag" :style="{ background: questionColor(row.questionId) + '1a' }">
              <span class="dot" :style="{ background: questionColor(row.questionId) }"></span>
              {{ row.questionId }}
            </span>
          </td>
          <td class="col-identity">
            <span class="tag">
              <span class="dot" :style="{ background: questionColor(row.questionId) }"></span>
              {{ t(identityName(row.identityTag)) }}
              <span class="sub-inline">{{ s(identityName(row.identityTag)) }}</span>
            </span>
          </td>
          <td class="col-answer">{{ row.answer }}</td>
          <td class="col-display">
            <button class="switch" :class="{ on: !row.isHidden }" :disabled="!canWrite" @click="toggleVisibility(row)">
              <span class="thumb"></span>
            </button>
            <span class="status-tag" :class="row.isHidden ? 'hidden' : 'visible'">
              <span class="dot" :style="{ background: row.isHidden ? '#eb5757' : '#27ae60' }"></span>
              {{ row.isHidden ? t(L.hidden) : t(L.visible) }}
            </span>
          </td>
          <td class="col-actions">
            <button class="link edit" :disabled="!canWrite" @click="openEdit(row)">{{ t(L.edit) }}</button>
            <button class="link delete" :disabled="!canWrite" @click="askDelete(row)">{{ t(L.delete) }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 分页 -->
  <div class="pagination">
    <div class="pager-info">
      <div class="primary-text">共 {{ total }} 条，第 {{ page }} / {{ totalPages || 1 }} 页</div>
      <div class="sub">{{ t(L.perPage) }}</div>
    </div>
    <div class="pager-nav">
      <button class="btn" :disabled="page <= 1" @click="goPage(page - 1)">{{ t(L.prev) }}</button>
      <button class="btn" :disabled="page >= totalPages" @click="goPage(page + 1)">{{ t(L.next) }}</button>
    </div>
  </div>

  <div class="scroll-hint">{{ t(L.scrollHint) }}</div>

  <!-- 编辑弹窗 -->
  <div v-if="editing" class="modal-mask" @click.self="closeEdit">
    <div class="modal">
      <h3 class="modal-title">{{ t(L.editTitle) }}</h3>
      <textarea v-model="editingText" class="modal-textarea" :placeholder="t(L.editPlaceholder)" maxlength="100"></textarea>
      <div class="modal-actions">
        <button class="btn" @click="closeEdit">{{ t(L.cancel) }}</button>
        <button class="btn btn-primary" :disabled="savingEdit" @click="saveEdit">{{ t(L.save) }}</button>
      </div>
    </div>
  </div>

  <!-- 删除确认弹窗 -->
  <div v-if="deleting" class="modal-mask" @click.self="deleting = null">
    <div class="modal">
      <h3 class="modal-title">{{ t(L.confirmDeleteTitle) }}</h3>
      <p class="modal-text">{{ t(L.confirmDeleteText) }}</p>
      <div class="modal-actions">
        <button class="btn" @click="deleting = null">{{ t(L.cancel) }}</button>
        <button class="btn btn-danger" :disabled="deletingBusy" @click="doDelete">{{ t(L.delete) }}</button>
      </div>
    </div>
  </div>

  <!-- 批量删除确认弹窗 -->
  <div v-if="batchDeleting" class="modal-mask" @click.self="batchDeleting = false">
    <div class="modal">
      <h3 class="modal-title">{{ t(L.confirmBatchDeleteTitle) }}</h3>
      <p class="modal-text">{{ t(L.confirmBatchDeleteText) }}</p>
      <div class="modal-actions">
        <button class="btn" @click="batchDeleting = false">{{ t(L.cancel) }}</button>
        <button class="btn btn-danger" :disabled="batchDeleteBusy" @click="doBatchDelete">{{ t(L.delete) }}</button>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
.answers-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.control {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  min-width: 140px;
}

.search-input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  flex: 1;
  min-width: 180px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-info {
  font-size: 13px;
  color: var(--text-muted);
}

.error-message {
  margin: 0;
  font-size: 13px;
  color: #e5484d;
}

.table-wrap {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: auto;
  max-height: 520px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1080px;
}

.table th {
  position: sticky;
  top: 0;
  background: #f7f9fc;
  text-align: left;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.table th .sub {
  display: block;
  font-weight: 400;
}

.table td {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.answer-row:last-child td {
  border-bottom: none;
}

.answer-row:hover td {
  background: #fafbfc;
}

.col-check { width: 48px; text-align: center; }
.col-time { width: 150px; }
.col-question { width: 90px; }
.col-identity { width: 160px; }
.col-answer { min-width: 280px; }
.col-display { width: 160px; }
.col-actions { width: 140px; }

.cell-loading {
  text-align: center;
  color: var(--text-muted);
  padding: 32px !important;
}

.primary-text {
  color: var(--text);
  font-size: 14px;
}

.sub {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}

.sub-inline {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 4px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
}

.switch {
  position: relative;
  width: 30px;
  height: 18px;
  border: none;
  border-radius: 999px;
  background: #d7dbe0;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
  vertical-align: middle;
}

.switch.on {
  background: var(--primary);
}

.switch:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.switch .thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.15s;
}

.switch.on .thumb {
  left: 14px;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #f7f9fc;
  font-size: 13px;
  color: var(--text);
  margin-left: 8px;
  white-space: nowrap;
}

.link {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  margin-right: 12px;
}

.link.edit { color: var(--primary); }
.link.delete { color: #eb5757; }
.link:disabled { opacity: 0.5; cursor: not-allowed; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pager-info { display: flex; flex-direction: column; gap: 2px; }
.pager-nav { display: flex; gap: 12px; }

.scroll-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.btn {
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  color: #fff;
}

.btn-danger {
  background: #fff;
  border-color: #f3c1c3;
  color: #eb5757;
}

.btn-danger:hover:not(:disabled) {
  background: #eb5757;
  border-color: #eb5757;
  color: #fff;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 41, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.modal {
  width: 420px;
  max-width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(31, 35, 41, 0.2);
}

.modal-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.modal-text {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
}

.modal-textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font: inherit;
  color: var(--text);
  resize: vertical;
}

.modal-textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-active-bg);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>

