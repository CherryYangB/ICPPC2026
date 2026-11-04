     <script lang="ts">
import {
  EffectScatterChart,
  ScatterChart,
  type EffectScatterSeriesOption,
  type ScatterSeriesOption,
} from 'echarts/charts'
import { GeoComponent, type GeoComponentOption } from 'echarts/components'
import { getMap, init, registerMap, use, type ComposeOption, type ECharts, type ECElementEvent } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([GeoComponent, ScatterChart, EffectScatterChart, CanvasRenderer])

type MapOption = ComposeOption<GeoComponentOption | ScatterSeriesOption | EffectScatterSeriesOption>
type BubbleSeriesOption = ScatterSeriesOption & { show?: boolean }
type GeoJsonSource = Parameters<typeof registerMap>[1]
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { useGeoAggregation, type CityBubble, type GeoLevel, type ProvinceBubble } from '@/composables/useGeoAggregation'
import { TYPE_FILTER_OPTIONS, useInstitutionFilters } from '@/composables/useInstitutionFilters'
import { useSocket } from '@/composables/useSocket'
import {
  checkinInstitution,
  fetchCheckedInInstitutions,
  fetchInstitutions,
  fetchInstitutionStats,
  toInstitution,
  type InstitutionStats,
} from '@/shared/api'
import type { CheckinEvent, Institution } from '@/types/institution'

import CheckinSuccessModal from '@/components/CheckinSuccessModal.vue'

const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

const MAP_NAME = 'china'
const MAP_URL = `${import.meta.env.BASE_URL}maps/china.json`

/** 缩放层级阈值：zoom > 该值时进入市级视图（后续可按交互手感调整） */
const ZOOM_THRESHOLD = 1.8


type DrawerScope =
  | { kind: 'province'; province: string }
  | { kind: 'city'; province: string; city: string }

/** 与 createProvinceSeries/createCitySeries 的 name 保持一致，点击事件据此判断层级 */
const PROVINCE_SERIES_NAME = '省级机构分布'
const CITY_SERIES_NAME = '市级机构分布'

/** 点击省级气泡后的平滑缩放目标 */
const FOCUS_ZOOM_LEVEL = 3
const FOCUS_ZOOM_MS = 800

/** 抽屉内容切换淡入淡出时长 */
const DRAWER_FADE_MS = 200

const mapRef = ref<HTMLDivElement | null>(null)
const mapStatus = ref<'loading' | 'ready' | 'error'>('loading')
const drawerScope = ref<DrawerScope | null>(null)
const drawerOpen = computed(() => drawerScope.value !== null)

/** 机构全量列表（来自后端），所有筛选在前端派生 */
const institutions = ref<Institution[]>([])
/** 数据加载状态：loading → skeleton，ready → 内容，error → 重试 */
const dataStatus = ref<'loading' | 'ready' | 'error'>('loading')
/** 后端统计（机构总量 + 已点亮省市） */
const stats = ref<InstitutionStats | null>(null)

const {
  selectedTypes,
  selectedProvince,
  keyword,
  provinceOptions,
  filteredInstitutions,
  hasActiveFilters,
  resetFilters,
} = useInstitutionFilters(institutions)

const { provinceBubbles, cityBubbles } = useGeoAggregation(filteredInstitutions)

// ---- 打卡（已点亮）联动状态 ----
/** checkin 后强化涟漪持续时长 */
const CHECKIN_HIGHLIGHT_MS = 3000
/** toast 停留时长 */
const TOAST_DURATION_MS = 3000
/** KPI 数字递增时长 */
const STAT_COUNT_MS = 300

/** 已点亮机构 id 集合（按钮 / 点位样式的唯一来源） */
const litInstitutionIds = reactive(new Set<string>())

const isInstitutionLit = (inst: Institution): boolean =>
  inst.id ? litInstitutionIds.has(inst.id) : Boolean(inst.isLit)

/** 用后端列表整体重建（初始化 / 重连） */
const syncLitIds = (ids: Iterable<string>) => {
  litInstitutionIds.clear()
  for (const id of ids) litInstitutionIds.add(id)
  for (const inst of institutions.value) {
    inst.isLit = inst.id ? litInstitutionIds.has(inst.id) : false
  }
}

/** 单机构点亮（本地打卡 / WS 事件） */
const markInstitutionLit = (id: string) => {
  if (!litInstitutionIds.has(id)) litInstitutionIds.add(id)
  const inst = institutions.value.find((item) => item.id === id)
  if (inst) inst.isLit = true
}

/** 已点亮机构，用于派生省/市常驻涟漪 */
const litInstitutions = computed(() => institutions.value.filter((inst) => isInstitutionLit(inst)))
const { provinceBubbles: litProvinceBubbles, cityBubbles: litCityBubbles } = useGeoAggregation(litInstitutions)

/** 3 秒强化涟漪目标（仅当前层级可见时放大变色） */
const activeLitProvince = ref<string | null>(null)
const activeLitCityKey = ref<string | null>(null)
let activeLitTimer: number | undefined

const clearActiveLit = () => {
  if (activeLitTimer !== undefined) {
    window.clearTimeout(activeLitTimer)
    activeLitTimer = undefined
  }
}

const startActiveLit = (province: string, city: string) => {
  clearActiveLit()
  activeLitProvince.value = province
  activeLitCityKey.value = province + '::' + city
  activeLitTimer = window.setTimeout(() => {
    activeLitTimer = undefined
    activeLitProvince.value = null
    activeLitCityKey.value = null
  }, CHECKIN_HIGHLIGHT_MS)
}

/** 右上角轻量 toast */
type ToastKind = 'success' | 'error'
interface ToastItem {
  id: number
  text: string
  kind: ToastKind
}
const toasts = ref<ToastItem[]>([])
let toastSeq = 0
const toastTimers = new Map<number, number>()

const pushToast = (text: string, kind: ToastKind = 'success') => {
  const id = ++toastSeq
  toasts.value = [...toasts.value, { id, text, kind }]
  const timer = window.setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
    toastTimers.delete(id)
  }, TOAST_DURATION_MS)
  toastTimers.set(id, timer)
}

/** KPI 数字 300ms 递增 */
const displayLitProvinces = ref(0)
const displayLitInstitutions = ref(0)
let litProvinceFrame: number | undefined
let litInstitutionFrame: number | undefined

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

const animateNumber = (target: { value: number }, to: number, which: 'province' | 'institution') => {
  const from = target.value
  const startedAt = window.performance.now()
  const currentFrame = which === 'province' ? litProvinceFrame : litInstitutionFrame
  if (currentFrame !== undefined) {
    window.cancelAnimationFrame(currentFrame)
  }

  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / STAT_COUNT_MS)
    target.value = Math.round(from + (to - from) * easeOutCubic(progress))
    if (progress < 1) {
      const frame = window.requestAnimationFrame(step)
      if (which === 'province') litProvinceFrame = frame
      else litInstitutionFrame = frame
    } else if (which === 'province') {
      litProvinceFrame = undefined
    } else {
      litInstitutionFrame = undefined
    }
  }

  const frame = window.requestAnimationFrame(step)
  if (which === 'province') litProvinceFrame = frame
  else litInstitutionFrame = frame
}

const animateLitStats = (litProvinces: number, litInstitutionCount: number) => {
  animateNumber(displayLitProvinces, litProvinces, 'province')
  animateNumber(displayLitInstitutions, litInstitutionCount, 'institution')
}

const statusItems = computed(() => [
  { label: '已收录机构数', value: String(filteredInstitutions.value.length) },
  { label: '已点亮省份数', value: String(displayLitProvinces.value) },
  { label: '在线打卡人数', value: String(displayLitInstitutions.value) },
])

/** 打卡按钮：请求中的机构 id 集合 */
const checkingInIds = reactive(new Set<string>())
/** 本地刚发起的打卡 id（抑制自身 WS toast，避免与弹窗重复） */
const selfCheckinIds = reactive(new Set<string>())
let selfCheckinTimer: number | undefined

const rememberSelfCheckin = (id: string) => {
  selfCheckinIds.add(id)
  if (selfCheckinTimer !== undefined) {
    window.clearTimeout(selfCheckinTimer)
  }
  selfCheckinTimer = window.setTimeout(() => {
    selfCheckinTimer = undefined
    selfCheckinIds.clear()
  }, 10000)
}

const clearSelfCheckin = () => {
  if (selfCheckinTimer !== undefined) {
    window.clearTimeout(selfCheckinTimer)
    selfCheckinTimer = undefined
  }
  selfCheckinIds.clear()
}

/** 卡片按钮三态：唯一入口（class / disabled / 文案同源） */
type CardCheckinState = 'idle' | 'checking' | 'lit'

const cardCheckinState = (inst: Institution): CardCheckinState => {
  if (isInstitutionLit(inst)) return 'lit'
  if (inst.id && checkingInIds.has(inst.id)) return 'checking'
  return 'idle'
}
/** 打卡成功弹窗状态（快照，与抽屉/筛选无关） */
const checkinSuccess = reactive({
  visible: false,
  institutionId: '',
  institutionName: '',
  litProvinces: 0,
  litInstitutions: 0,
})

const openCheckinSuccess = (institution: Institution, litProvinces: number, litInstitutions: number) => {
  checkinSuccess.institutionId = institution.id ?? ''
  checkinSuccess.institutionName = institution.name ?? '未命名机构'
  checkinSuccess.litProvinces = litProvinces
  checkinSuccess.litInstitutions = litInstitutions
  checkinSuccess.visible = true
}

const closeCheckinSuccess = () => {
  checkinSuccess.visible = false
}

const handleCheckinClick = async (inst: Institution) => {
  if (!inst.id || cardCheckinState(inst) !== 'idle') {
    return
  }
  checkingInIds.add(inst.id)
  rememberSelfCheckin(inst.id)

  try {
    const response = await checkinInstitution(Number(inst.id))
    markInstitutionLit(inst.id)

    // 计数优先用后端返回的实时统计；?? 兜底用于前端先于后端发布的过渡期
    const litList = institutions.value.filter((item) => isInstitutionLit(item))
    const litProvinces = response.litProvinces ?? new Set(litList.map((item) => item.province)).size
    const litInstitutions = response.litInstitutions ?? litList.length
    const litCities =
      response.litCities ?? stats.value?.litCities ?? new Set(litList.map((item) => item.city)).size

    animateLitStats(litProvinces, litInstitutions)
    if (stats.value) {
      stats.value = { ...stats.value, litProvinces, litInstitutions, litCities }
    }

    const institutionName = response.nameZh || inst.name || '未命名机构'
    if (response.alreadyLit) {
      // 已点亮 / 10s 防刷窗口内：后端不再广播，这里只提示，不弹「打卡成功」
      pushToast(institutionName + ' 已点亮')
    } else {
      openCheckinSuccess({ ...inst, name: institutionName }, litProvinces, litInstitutions)
    }
  } catch (error) {
    console.error('[ResourceMap] Failed to checkin institution', error)
    pushToast('打卡失败，请重试', 'error')
  } finally {
    checkingInIds.delete(inst.id)
  }
}

const provinceMenuOpen = ref(false)
const selectWrapRef = ref<HTMLElement | null>(null)

const selectProvince = (province: string) => {
  selectedProvince.value = province
  provinceMenuOpen.value = false
}

const handleDocPointerDown = (event: PointerEvent) => {
  if (selectWrapRef.value && !selectWrapRef.value.contains(event.target as Node)) {
    provinceMenuOpen.value = false
  }
}

const handleDocKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    provinceMenuOpen.value = false
  }
}

const currentLevel = ref<GeoLevel>('province')
const currentZoom = ref(1)

const handleZoomChange = (zoom: number) => {
  currentZoom.value = zoom
  currentLevel.value = zoom > ZOOM_THRESHOLD ? 'city' : 'province'
}

// defineExpose 统一放在文件末尾（需在 handleChartClick 等声明之后，避免 TDZ 访问）

let chart: ECharts | null = null
let disposed = false

const PROVINCE_SERIES_ID = 'province-bubbles'
const CITY_SERIES_ID = 'city-bubbles'
const LIT_PROVINCE_SERIES_ID = 'lit-province-ripples'
const LIT_CITY_SERIES_ID = 'lit-city-ripples'
const LIT_PROVINCE_ACTIVE_SERIES_ID = 'lit-province-active'
const LIT_CITY_ACTIVE_SERIES_ID = 'lit-city-active'
const LEVEL_TRANSITION_MS = 300

const PROVINCE_SYMBOL_BASE = 20
const PROVINCE_SYMBOL_STEP = 4
const PROVINCE_SYMBOL_MAX = 60

// 市级气泡略小于省级：count=1→17px，count=2→20px（对比省级 count=5→40px）
const CITY_SYMBOL_BASE = 14
const CITY_SYMBOL_STEP = 3
const CITY_SYMBOL_MAX = 44

// 不同 zlevel = 不同 canvas 层；数值越高越靠上，市级覆盖省级之上避免重叠时点击被遮挡
const PROVINCE_SERIES_ZLEVEL = 2
const CITY_SERIES_ZLEVEL = 3
const LIT_PROVINCE_ZLEVEL = 4
const LIT_CITY_ZLEVEL = 5
const LIT_ACTIVE_ZLEVEL = 6

/** 省级气泡直径：Math.min(60, 20 + count * 4)，count 取自 value[2] */
const provinceSymbolSize = (value: unknown): number => {
  const count = Array.isArray(value) ? Number(value[2]) : Number.NaN
  const safeCount = Number.isFinite(count) ? Math.max(count, 0) : 0
  return Math.min(PROVINCE_SYMBOL_MAX, PROVINCE_SYMBOL_BASE + safeCount * PROVINCE_SYMBOL_STEP)
}

/** 市级气泡直径（略小于省级）：Math.min(44, 14 + count * 3)，count 取自 value[2] */
const citySymbolSize = (value: unknown): number => {
  const count = Array.isArray(value) ? Number(value[2]) : Number.NaN
  const safeCount = Number.isFinite(count) ? Math.max(count, 0) : 0
  return Math.min(CITY_SYMBOL_MAX, CITY_SYMBOL_BASE + safeCount * CITY_SYMBOL_STEP)
}

const toProvinceSeriesData = (bubbles: readonly ProvinceBubble[]) =>
  bubbles.map((bubble) => ({
    name: bubble.province,
    value: [bubble.lng, bubble.lat, bubble.count],
    label: { formatter: String(bubble.count) },
  }))

const toCitySeriesData = (bubbles: readonly CityBubble[]) =>
  bubbles.map((bubble) => ({
    name: bubble.city,
    value: [bubble.lng, bubble.lat, bubble.count],
    label: { formatter: String(bubble.count) },
  }))

const toLitProvinceData = (bubbles: readonly ProvinceBubble[]) =>
  bubbles.map((bubble) => ({
    name: bubble.province,
    value: [bubble.lng, bubble.lat, bubble.count],
  }))

const toLitCityData = (bubbles: readonly CityBubble[]) =>
  bubbles.map((bubble) => ({
    name: bubble.city,
    value: [bubble.lng, bubble.lat, bubble.count],
  }))

const BUBBLE_LABEL: ScatterSeriesOption['label'] = {
  show: true,
  position: 'inside',
  color: '#ffffff',
  fontWeight: 'bold',
  fontSize: 12,
}

const bubbleAnimation = () => ({
  animationDuration: LEVEL_TRANSITION_MS,
  animationDurationUpdate: LEVEL_TRANSITION_MS,
})

const createProvinceSeries = (show: boolean): BubbleSeriesOption => ({
  id: PROVINCE_SERIES_ID,
  name: PROVINCE_SERIES_NAME,
  type: 'scatter',
  coordinateSystem: 'geo',
  geoIndex: 0,
  zlevel: PROVINCE_SERIES_ZLEVEL,
  show,
  // ECharts 渲染管线不识别 series.show=false，因此非激活时用 0 尺寸隐藏（与淡出终态一致）
  symbolSize: show ? provinceSymbolSize : () => 0,
  data: toProvinceSeriesData(provinceBubbles.value),
  label: show ? BUBBLE_LABEL : { show: false },
  itemStyle: {
    color: 'rgba(47, 128, 237, 0.38)',
    borderColor: '#2F80ED',
    borderWidth: 2,
    shadowBlur: 16,
    shadowColor: 'rgba(47, 128, 237, 0.85)',
  },
  emphasis: { scale: 1.15, itemStyle: { color: 'rgba(47, 128, 237, 0.62)' } },
  ...bubbleAnimation(),
})

const createCitySeries = (show: boolean): BubbleSeriesOption => ({
  id: CITY_SERIES_ID,
  name: CITY_SERIES_NAME,
  type: 'scatter',
  coordinateSystem: 'geo',
  geoIndex: 0,
  zlevel: CITY_SERIES_ZLEVEL,
  show,
  // 同上：非激活时用 0 尺寸隐藏，避免初始态市级气泡残留
  symbolSize: show ? citySymbolSize : () => 0,
  data: toCitySeriesData(cityBubbles.value),
  label: show ? BUBBLE_LABEL : { show: false },
  itemStyle: {
    color: 'rgba(39, 174, 96, 0.38)',
    borderColor: '#27AE60',
    borderWidth: 2,
    shadowBlur: 16,
    shadowColor: 'rgba(39, 174, 96, 0.85)',
  },
  emphasis: { scale: 1.15, itemStyle: { color: 'rgba(39, 174, 96, 0.62)' } },
  ...bubbleAnimation(),
})

/** 已点亮常驻涟漪：steady 与 3 秒强化两套节奏 */
const LIT_RIPPLE = { period: 4, scale: 3, brushType: 'stroke' as const }
const LIT_ACTIVE_RIPPLE = { period: 1, scale: 6, brushType: 'stroke' as const }

const createLitProvinceSeries = (): EffectScatterSeriesOption => ({
  id: LIT_PROVINCE_SERIES_ID,
  type: 'effectScatter',
  coordinateSystem: 'geo',
  geoIndex: 0,
  zlevel: LIT_PROVINCE_ZLEVEL,
  showEffectOn: 'render',
  rippleEffect: LIT_RIPPLE,
  symbolSize: 14,
  silent: true,
  label: { show: false },
  data: [],
  itemStyle: {
    color: '#F2C94C',
    borderColor: '#FFE29A',
    borderWidth: 1,
    shadowBlur: 18,
    shadowColor: 'rgba(242, 201, 76, 0.9)',
  },
})

const createLitCitySeries = (): EffectScatterSeriesOption => ({
  id: LIT_CITY_SERIES_ID,
  type: 'effectScatter',
  coordinateSystem: 'geo',
  geoIndex: 0,
  zlevel: LIT_CITY_ZLEVEL,
  showEffectOn: 'render',
  rippleEffect: LIT_RIPPLE,
  symbolSize: 12,
  silent: true,
  label: { show: false },
  data: [],
  itemStyle: {
    color: '#F2C94C',
    borderColor: '#FFE29A',
    borderWidth: 1,
    shadowBlur: 18,
    shadowColor: 'rgba(242, 201, 76, 0.9)',
  },
})

const createLitActiveSeries = (id: string): EffectScatterSeriesOption => ({
  id,
  type: 'effectScatter',
  coordinateSystem: 'geo',
  geoIndex: 0,
  zlevel: LIT_ACTIVE_ZLEVEL,
  showEffectOn: 'render',
  rippleEffect: LIT_ACTIVE_RIPPLE,
  symbolSize: 18,
  silent: true,
  label: { show: false },
  data: [],
  itemStyle: {
    color: '#FFC542',
    borderColor: '#FFE29A',
    borderWidth: 1,
    shadowBlur: 26,
    shadowColor: 'rgba(255, 197, 66, 0.95)',
  },
})

/** 从 ECharts geo 组件读取当前缩放级别，驱动 handleZoomChange */
const syncZoomFromChart = () => {
  const geo = chart?.getOption().geo
  if (!Array.isArray(geo) || geo.length === 0) {
    return
  }
  const zoom = (geo[0] as { zoom?: unknown } | undefined)?.zoom
  if (typeof zoom !== 'number') {
    return
  }
  handleZoomChange(zoom)
}

let hideBubblesTimer: number | undefined

const clearHideBubblesTimer = () => {
  if (hideBubblesTimer !== undefined) {
    window.clearTimeout(hideBubblesTimer)
    hideBubblesTimer = undefined
  }
}

/** 按层级交叉切换省市气泡：激活系列 show:true 淡入，非激活系列 300ms 缩放淡出后落定 show:false */
const syncBubbleVisibility = (level: GeoLevel) => {
  if (!chart) {
    return
  }
  clearHideBubblesTimer()

  const cityActive = level === 'city'

  // show:true → 激活系列元素重建走 initProps：scale 0→1 + opacity 0→1（300ms 淡入）；
  // 非激活系列先补间缩小到 0（updateProps，300ms 缩放淡出），再落定 show:false。
  chart.setOption({
    series: [
      {
        id: PROVINCE_SERIES_ID,
        show: true,
        symbolSize: cityActive ? () => 0 : provinceSymbolSize,
        label: { show: !cityActive },
      },
      {
        id: CITY_SERIES_ID,
        show: true,
        symbolSize: cityActive ? citySymbolSize : () => 0,
        label: { show: cityActive },
      },
    ],
  })

  const inactiveId = cityActive ? PROVINCE_SERIES_ID : CITY_SERIES_ID
  hideBubblesTimer = window.setTimeout(() => {
    hideBubblesTimer = undefined
    chart?.setOption({ series: [{ id: inactiveId, show: false }] })
  }, LEVEL_TRANSITION_MS)
}

watch(currentLevel, (level) => syncBubbleVisibility(level))

const activeCityKeyOf = (bubble: CityBubble) => bubble.province + '::' + bubble.city

const resolveActiveProvinceData = () => {
  if (currentLevel.value !== 'province' || !activeLitProvince.value) {
    return []
  }
  return toLitProvinceData(
    litProvinceBubbles.value.filter((bubble) => bubble.province === activeLitProvince.value),
  )
}

const resolveActiveCityData = () => {
  if (currentLevel.value !== 'city' || !activeLitCityKey.value) {
    return []
  }
  return toLitCityData(
    litCityBubbles.value.filter((bubble) => activeCityKeyOf(bubble) === activeLitCityKey.value),
  )
}

/** 同步已点亮涟漪 series 的 data（随层级 / 打卡高亮变化） */
const syncLitSeries = () => {
  if (!chart) {
    return
  }
  const showProvince = currentLevel.value === 'province'
  const showCity = currentLevel.value === 'city'
  chart.setOption({
    series: [
      {
        id: LIT_PROVINCE_SERIES_ID,
        data: showProvince ? toLitProvinceData(litProvinceBubbles.value) : [],
      },
      {
        id: LIT_CITY_SERIES_ID,
        data: showCity ? toLitCityData(litCityBubbles.value) : [],
      },
      { id: LIT_PROVINCE_ACTIVE_SERIES_ID, data: resolveActiveProvinceData() },
      { id: LIT_CITY_ACTIVE_SERIES_ID, data: resolveActiveCityData() },
    ],
  })
}

watch(
  [litProvinceBubbles, litCityBubbles, currentLevel, activeLitProvince, activeLitCityKey],
  () => syncLitSeries(),
)

// 筛选变化时按 id 原地更新气泡 data，保留当前层级显隐与动画
watch([provinceBubbles, cityBubbles], () => {
  if (!chart) {
    return
  }
  chart.setOption({
    series: [
      { id: PROVINCE_SERIES_ID, data: toProvinceSeriesData(provinceBubbles.value) },
      { id: CITY_SERIES_ID, data: toCitySeriesData(cityBubbles.value) },
    ],
  })
})

const scale = ref(
  Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT),
)

const updateScale = () => {
  scale.value = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT)
}

const mapFeedback = computed(() =>
  mapStatus.value === 'error'
    ? '地图加载失败，请检查网络或数据文件。 / Failed to load map data.'
    : '正在加载中国地图… / Loading China map…',
)

const closeDrawer = () => {
  drawerScope.value = null
}

/** 当前抽屉对应的机构集合（含无坐标机构） */
const scopeInstitutions = computed<Institution[]>(() => {
  const scope = drawerScope.value
  if (!scope) {
    return []
  }
  return filteredInstitutions.value.filter((inst) =>
    scope.kind === 'province'
      ? inst.province === scope.province
      : inst.province === scope.province && inst.city === scope.city,
  )
})

const drawerTotal = computed(() => scopeInstitutions.value.length)

/** 统一按「分组」渲染：省级=按城市多组，市级=无标题单组 */
interface DrawerGroup {
  key: string
  title: string | null
  items: Institution[]
}

const drawerGroups = computed<DrawerGroup[]>(() => {
  const scope = drawerScope.value
  if (!scope) {
    return []
  }
  if (scope.kind === 'city') {
    return [{ key: `${scope.province}/${scope.city}`, title: null, items: scopeInstitutions.value }]
  }

  const groups = new Map<string, Institution[]>()
  for (const inst of scopeInstitutions.value) {
    const city = inst.city?.trim() || '未标注城市'
    const items = groups.get(city) ?? []
    items.push(inst)
    groups.set(city, items)
  }
  return [...groups.entries()]
    .map(([city, items]) => ({ key: city, title: city, items }))
    .sort((a, b) => b.items.length - a.items.length || a.title!.localeCompare(b.title!, 'zh'))
})

const drawerTitle = computed(() => {
  const scope = drawerScope.value
  if (!scope) {
    return ''
  }
  const name = scope.kind === 'province' ? scope.province : scope.city
  return `${name} · 共 ${drawerTotal.value} 家机构`
})

const drawerSubtitle = computed(() =>
  drawerScope.value?.kind === 'province' ? '按城市分组 / Grouped by city' : '机构列表 / Institution list',
)

const drawerKey = computed(() => {
  const scope = drawerScope.value
  if (!scope) {
    return 'closed'
  }
  return scope.kind === 'province' ? `province:${scope.province}` : `city:${scope.province}:${scope.city}`
})

/** 卡片手风琴展开状态（同时只展开一张） */
const expandedInstitutionId = ref<string | null>(null)
const institutionKey = (inst: Institution): string =>
  inst.id ?? `${inst.province}-${inst.city}-${inst.name ?? ''}`
const isExpanded = (inst: Institution): boolean => expandedInstitutionId.value === institutionKey(inst)
const toggleExpanded = (inst: Institution) => {
  const key = institutionKey(inst)
  expandedInstitutionId.value = expandedInstitutionId.value === key ? null : key
}

/** 是否具备可展开的病房项目 / 门诊科室明细 */
const hasInstitutionDetails = (inst: Institution): boolean =>
  Boolean(inst.wardProjects?.length || inst.clinicDepartments?.length)
watch(drawerScope, () => {
  expandedInstitutionId.value = null
})

const openProvinceDrawer = (province: string) => {
  drawerScope.value = { kind: 'province', province }
}

const openCityDrawer = (province: string, city: string) => {
  drawerScope.value = { kind: 'city', province, city }
}

/** 返回：市级列表 → 回到该省列表（抽屉不关）；省级列表 → 关闭抽屉 */
const handleDrawerBack = () => {
  const scope = drawerScope.value
  if (scope?.kind === 'city') {
    drawerScope.value = { kind: 'province', province: scope.province }
  } else {
    drawerScope.value = null
  }
}

/** 点击省级气泡：平滑缩放到该省，并驱动层级切到市级（程序化 setOption 不触发 georoam） */
const focusProvince = (lng: number, lat: number) => {
  chart?.setOption({
    animationDurationUpdate: FOCUS_ZOOM_MS,
    geo: { center: [lng, lat], zoom: FOCUS_ZOOM_LEVEL },
  })
  handleZoomChange(FOCUS_ZOOM_LEVEL)
}

const handleChartClick = (params: ECElementEvent) => {
  if (params.componentType !== 'series') {
    return
  }
  if (params.seriesName === PROVINCE_SERIES_NAME) {
    const bubble =
      provinceBubbles.value[params.dataIndex] ?? provinceBubbles.value.find((b) => b.province === params.name)
    if (!bubble) {
      return
    }
    focusProvince(bubble.lng, bubble.lat)
    openProvinceDrawer(bubble.province)
    return
  }
  if (params.seriesName === CITY_SERIES_NAME) {
    const bubble =
      cityBubbles.value[params.dataIndex] ?? cityBubbles.value.find((b) => b.city === params.name)
    if (!bubble) {
      return
    }
    openCityDrawer(bubble.province, bubble.city)
  }
}

const renderMap = (geoJson: GeoJsonSource) => {
  const container = mapRef.value
  if (disposed || !container) {
    return
  }

  registerMap(MAP_NAME, geoJson)

  if (!getMap(MAP_NAME)) {
    throw new Error(`Failed to register map "${MAP_NAME}"`)
  }

  chart = init(container)
  chart.on('georoam', syncZoomFromChart)
  chart.on('click', handleChartClick)

  const option: MapOption = {
    backgroundColor: 'transparent',
    animationDuration: LEVEL_TRANSITION_MS,
    animationDurationUpdate: LEVEL_TRANSITION_MS,
    geo: {
      map: MAP_NAME,
      roam: true,
      left: 170,
      right: 170,
      top: 56,
      bottom: 48,
      label: {
        show: false,
      },
      itemStyle: {
        areaColor: '#1a2740',
        borderColor: '#2f4a6e',
        borderWidth: 1,
      },
      emphasis: {
        label: {
          show: true,
          color: '#ffffff',
          fontSize: 14,
        },
        itemStyle: {
          areaColor: '#2f80ed',
          borderColor: '#2f80ed',
        },
      },
    },
    series: [
      createProvinceSeries(currentLevel.value === 'province'),
      createCitySeries(currentLevel.value === 'city'),
      createLitProvinceSeries(),
      createLitCitySeries(),
      createLitActiveSeries(LIT_PROVINCE_ACTIVE_SERIES_ID),
      createLitActiveSeries(LIT_CITY_ACTIVE_SERIES_ID),
    ],
  }

  chart.setOption(option)
  syncLitSeries()
  mapStatus.value = 'ready'
}

/** 并行拉取机构列表、统计与已点亮列表；失败置 error，供浮动按钮重新触发 */
let dataRequestId = 0
const loadInstitutions = async () => {
  const requestId = ++dataRequestId
  dataStatus.value = 'loading'

  try {
    const [list, statsResult, checkedIn] = await Promise.all([
      fetchInstitutions(),
      fetchInstitutionStats(),
      fetchCheckedInInstitutions(),
    ])
    if (disposed || requestId !== dataRequestId) {
      return
    }
    const litIds = new Set(checkedIn.map((item) => String(item.id)))
    institutions.value = list.map((dto) => toInstitution(dto))
    syncLitIds(litIds)
    stats.value = statsResult
    animateLitStats(statsResult.litProvinces, statsResult.litInstitutions)
    dataStatus.value = 'ready'
  } catch (error) {
    if (disposed || requestId !== dataRequestId) {
      return
    }
    dataStatus.value = 'error'
    console.error('[ResourceMap] Failed to load institutions', error)
  }
}

/** 重连后重新拉取已点亮列表，并回写 isLit / KPI */
const refreshCheckedIn = async () => {
  try {
    const checkedIn = await fetchCheckedInInstitutions()
    if (disposed) {
      return
    }
    syncLitIds(checkedIn.map((item) => String(item.id)))
    const provinces = new Set(checkedIn.map((item) => item.province))
    animateLitStats(provinces.size, checkedIn.length)
    if (stats.value) {
      stats.value = { ...stats.value, litProvinces: provinces.size, litInstitutions: checkedIn.length }
    }
  } catch (error) {
    console.error('[ResourceMap] Failed to refresh checked-in institutions', error)
  }
}

// ---- WebSocket：checkin 事件 / 断线重连 ----
const { connected, on: onSocket } = useSocket()
const hasDisconnected = ref(false)
const showReconnectBanner = computed(() => hasDisconnected.value && !connected.value)

const handleCheckin = (payload: CheckinEvent) => {
  const id = String(payload.institutionId)
  markInstitutionLit(id)

  startActiveLit(payload.province, payload.city)
  animateLitStats(payload.litProvinces, payload.litInstitutions)
  if (stats.value) {
    stats.value = {
      ...stats.value,
      litProvinces: payload.litProvinces,
      litInstitutions: payload.litInstitutions,
      litCities: payload.litCities ?? stats.value.litCities,
    }
  }
  if (!selfCheckinIds.has(id)) {
    pushToast(payload.nameZh + ' 已点亮')
  }
}

onSocket('checkin', handleCheckin)

watch(connected, (value, oldValue) => {
  if (!value && oldValue) {
    hasDisconnected.value = true
  }
  if (value && !oldValue && hasDisconnected.value) {
    hasDisconnected.value = false
    void refreshCheckedIn()
  }
})

const loadChinaMap = async () => {
  try {
    const response = await fetch(MAP_URL)
    if (!response.ok) {
      throw new Error(`Failed to load ${MAP_URL} (HTTP ${response.status})`)
    }

    const geoJson = (await response.json()) as GeoJsonSource
    if (disposed) {
      return
    }

    renderMap(geoJson)
  } catch (error) {
    if (disposed) {
      return
    }

    mapStatus.value = 'error'
    console.error('[ResourceMap] Failed to load China map', error)
  }
}

const handleResize = () => {
  updateScale()
  chart?.resize()
}

onMounted(() => {
  updateScale()
  window.addEventListener('resize', handleResize)
  document.addEventListener('pointerdown', handleDocPointerDown)
  document.addEventListener('keydown', handleDocKeyDown)
  void loadChinaMap()
  void loadInstitutions()
})

onBeforeUnmount(() => {
  disposed = true
  clearHideBubblesTimer()
  clearActiveLit()
  clearSelfCheckin()
  if (litProvinceFrame !== undefined) {
    window.cancelAnimationFrame(litProvinceFrame)
    litProvinceFrame = undefined
  }
  if (litInstitutionFrame !== undefined) {
    window.cancelAnimationFrame(litInstitutionFrame)
    litInstitutionFrame = undefined
  }
  for (const timer of toastTimers.values()) {
    window.clearTimeout(timer)
  }
  toastTimers.clear()
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('pointerdown', handleDocPointerDown)
  document.removeEventListener('keydown', handleDocKeyDown)
  chart?.off('georoam', syncZoomFromChart)
  chart?.off('click', handleChartClick)
  chart?.dispose()
  chart = null
})

defineExpose({
  handleZoomChange,
  currentLevel,
  currentZoom,
  provinceBubbles,
  cityBubbles,
  drawerScope,
  drawerOpen,
  drawerGroups,
  drawerTotal,
  handleChartClick,
  selectedTypes,
  selectedProvince,
  keyword,
  filteredInstitutions,
  provinceOptions,
  hasActiveFilters,
  resetFilters,
  dataStatus,
  stats,
  loadInstitutions,
  litInstitutions,
  litInstitutionIds,
  isInstitutionLit,
  connected,
  showReconnectBanner,
  toasts,
  handleCheckin,
  handleCheckinClick,
  checkinSuccess,
  openCheckinSuccess,
  closeCheckinSuccess,
  refreshCheckedIn,
  getChartInstance: () => chart,
})
</script>

<template>
  <div class="screen-viewport">
    <div class="screen-stage" :style="{ transform: `translate(-50%, -50%) scale(${scale})` }">
      <div class="map-page">
        <header class="screen-header">
          <div class="brand">
            <h1 class="brand-title">第六届儿童舒缓安宁国际大会（2026）</h1>
            <p class="brand-subtitle">
              6th International Conference on Paediatric Palliative Care · 2026
            </p>
          </div>
          <nav class="screen-nav" aria-label="大屏导航">
            <span class="nav-pill">大会总览 / Overview</span>
            <span class="nav-pill">八问集合 / Eight questions</span>
            <span class="nav-pill is-active">参与网络 / Network</span>
          </nav>
        </header>

        <section class="intro-row">
          <h2 class="intro-title">连接机构，让照护不止于医院</h2>
          <p class="intro-subtitle">Connecting institutions · Care beyond the hospital</p>
        </section>

        <main class="map-main">
          <aside class="filter-panel">
            <h3 class="panel-title">筛选</h3>

            <div class="filter-group">
              <p class="group-label">机构类型</p>
              <div class="type-grid">
                <label
                  v-for="option in TYPE_FILTER_OPTIONS"
                  :key="option"
                  class="type-chip"
                  :class="{ 'is-active': selectedTypes.includes(option) }"
                >
                  <input v-model="selectedTypes" type="checkbox" class="type-checkbox" :value="option" />
                  <span>{{ option }}</span>
                </label>
              </div>
            </div>

            <div class="filter-group">
              <p class="group-label">所在省份</p>
              <div ref="selectWrapRef" class="select-wrap">
                <button
                  type="button"
                  class="select-field"
                  :class="{ 'is-selected': selectedProvince }"
                  :disabled="dataStatus !== 'ready'"
                  :aria-expanded="provinceMenuOpen"
                  aria-haspopup="listbox"
                  @click="provinceMenuOpen = !provinceMenuOpen"
                >
                  <span>{{ selectedProvince || '全部省份' }}</span>
                  <span class="select-chevron" aria-hidden="true"></span>
                </button>
                <ul v-if="provinceMenuOpen" class="province-menu" role="listbox" aria-label="选择省份">
                  <li>
                    <button
                      type="button"
                      role="option"
                      class="province-option"
                      :class="{ 'is-active': selectedProvince === '' }"
                      :aria-selected="selectedProvince === ''"
                      @click="selectProvince('')"
                    >
                      全部省份
                    </button>
                  </li>
                  <li v-for="province in provinceOptions" :key="province">
                    <button
                      type="button"
                      role="option"
                      class="province-option"
                      :class="{ 'is-active': selectedProvince === province }"
                      :aria-selected="selectedProvince === province"
                      @click="selectProvince(province)"
                    >
                      {{ province }}
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div class="filter-group">
              <p class="group-label">关键词搜索</p>
              <div class="search-field">
                <input
                  v-model="keyword"
                  type="search"
                  class="search-input"
                  placeholder="搜索机构名称 / 简介"
                  aria-label="关键词搜索"
                />
                <button
                  v-if="keyword"
                  type="button"
                  class="search-clear"
                  aria-label="清除搜索"
                  @click="keyword = ''"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </div>

            <p v-if="hasActiveFilters" class="filter-result" aria-live="polite">
              筛选结果 {{ filteredInstitutions.length }} 家
            </p>

            <button
              type="button"
              class="reset-button"
              :disabled="!hasActiveFilters"
              @click="resetFilters"
            >
              重置筛选
            </button>
          </aside>

          <div class="map-container">
            <div class="map-heading">
              <h3 class="map-title">中国参与分布</h3>
              <p class="map-subtitle">Real-time institution distribution</p>
            </div>
            <p
              v-if="mapStatus !== 'ready'"
              class="map-feedback"
              :class="{ 'is-error': mapStatus === 'error' }"
              role="status"
              aria-live="polite"
            >
              {{ mapFeedback }}
            </p>
            <div ref="mapRef" class="map-canvas"></div>
            <div v-if="dataStatus !== 'ready'" class="data-overlay" role="status" aria-live="polite">
              <div v-if="dataStatus === 'loading'" class="map-skeleton" aria-label="数据加载中">
                <span class="skeleton skeleton-bubble"></span>
                <span class="skeleton skeleton-line"></span>
                <span class="skeleton skeleton-line is-short"></span>
              </div>
              <button v-else type="button" class="data-retry" @click="loadInstitutions">
                加载失败，点击重试
              </button>
            </div>
            <p class="map-caption">
              数据来自后端机构库，气泡大小代表该区域收录机构数量。 / Bubble size reflects the
              number of institutions recorded in each region.
            </p>
          </div>
        </main>

        <footer class="status-bar">
          <div
            v-for="(item, index) in statusItems"
            :key="item.label"
            class="status-item"
            :class="{ 'has-divider': index > 0 }"
          >
            <span
              v-if="dataStatus === 'loading'"
              class="status-value status-value-skeleton skeleton"
              aria-hidden="true"
            ></span>
            <span v-else class="status-value">{{ dataStatus === 'error' ? '—' : item.value }}</span>
            <span class="status-label">{{ item.label }}</span>
          </div>
        </footer>

        <aside class="detail-drawer" :class="{ 'is-open': drawerOpen }" :aria-hidden="!drawerOpen">
          <Transition name="drawer-fade" mode="out-in" :duration="DRAWER_FADE_MS">
            <div v-if="drawerScope" :key="drawerKey" class="drawer-inner">
              <header class="drawer-header">
                <div class="drawer-heading">
                  <h3 class="drawer-title">{{ drawerTitle }}</h3>
                  <p class="drawer-subtitle">{{ drawerSubtitle }}</p>
                </div>
                <div class="drawer-actions">
                  <button
                    type="button"
                    class="drawer-close"
                    aria-label="返回上一级"
                    @click="handleDrawerBack"
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <button
                    type="button"
                    class="drawer-close"
                    aria-label="关闭机构列表"
                    @click="closeDrawer"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </header>
              <div class="drawer-body">
                <section v-for="group in drawerGroups" :key="group.key" class="city-group">
                  <h4 v-if="group.title" class="city-group-title">
                    {{ group.title }}
                    <span class="city-group-count">{{ group.items.length }} 家</span>
                  </h4>
                  <ul class="institution-list">
                    <li
                      v-for="inst in group.items"
                      :key="institutionKey(inst)"
                      class="institution-card"
                      :class="{ 'is-expanded': isExpanded(inst) }"
                    >
                      <div class="card-row">
                        <button
                          type="button"
                          class="card-summary"
                          :aria-expanded="isExpanded(inst)"
                          @click="toggleExpanded(inst)"
                        >
                          <span class="card-heading">
                            <span class="card-name">{{ inst.name ?? '未命名机构' }}</span>
                            <span v-if="isInstitutionLit(inst)" class="card-lit-badge">
                              <span class="card-lit-dot" aria-hidden="true"></span>
                              已点亮
                            </span>
                          </span>
                          <span v-if="inst.nameEn" class="card-name-en">{{ inst.nameEn }}</span>
                          <span class="card-meta">
                            <span v-if="inst.hasWard" class="card-tag is-ward">安宁疗护病房</span>
                            <span v-if="inst.hasClinic" class="card-tag is-clinic">舒缓门诊</span>
                            <span v-if="inst.address" class="card-address">{{ inst.address }}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          class="card-checkin"
                          :class="{ 'is-lit': cardCheckinState(inst) === 'lit', 'is-loading': cardCheckinState(inst) === 'checking' }"
                          :disabled="cardCheckinState(inst) !== 'idle'"
                          @click.stop="handleCheckinClick(inst)"
                        >
                          <span v-if="cardCheckinState(inst) === 'checking'" class="checkin-spinner" aria-hidden="true"></span>
                          <span>{{ cardCheckinState(inst) === 'lit' ? '已点亮' : cardCheckinState(inst) === 'checking' ? '打卡中' : '打卡点亮' }}</span>
                        </button>
                      </div>
                      <div v-if="isExpanded(inst)" class="card-detail">
                        <template v-if="inst.wardProjects?.length">
                          <p class="card-section-label">病房项目</p>
                          <ul class="card-project-list">
                            <li
                              v-for="(project, index) in inst.wardProjects"
                              :key="'ward-' + index"
                              class="card-project-item"
                            >
                              {{ project }}
                            </li>
                          </ul>
                        </template>
                        <template v-if="inst.clinicDepartments?.length">
                          <p class="card-section-label">门诊科室</p>
                          <ul class="card-project-list">
                            <li
                              v-for="(dept, index) in inst.clinicDepartments"
                              :key="'clinic-' + index"
                              class="card-project-item"
                            >
                              {{ dept }}
                            </li>
                          </ul>
                        </template>
                        <p v-if="!hasInstitutionDetails(inst)" class="card-detail-empty">
                          暂无病房 / 门诊明细
                        </p>
                      </div>
                    </li>
                  </ul>
                </section>
                <p v-if="drawerTotal === 0" class="drawer-empty">暂无机构数据</p>
              </div>
            </div>
          </Transition>
        </aside>

        <TransitionGroup name="toast" tag="div" class="toast-stack" aria-live="polite">
          <div
            v-for="toast in toasts"
            :key="toast.id"
            class="toast-item"
            :class="{ 'is-error': toast.kind === 'error' }"
          >
            {{ toast.text }}
          </div>
        </TransitionGroup>

        <p v-if="showReconnectBanner" class="reconnect-banner" role="status" aria-live="polite">
          连接中断，正在重连
        </p>

        <CheckinSuccessModal
          :visible='checkinSuccess.visible'
          :institution-name='checkinSuccess.institutionName'
          :lit-provinces='checkinSuccess.litProvinces'
          :lit-institutions='checkinSuccess.litInstitutions'
          @close='closeCheckinSuccess'
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.screen-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--screen-bg);
}

.screen-stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1920px;
  height: 1080px;
  transform-origin: center center;
  will-change: transform;
}

.map-page {
  --panel-inset: #16243a;
  --accent: #2f80ed;
  --line: rgba(255, 255, 255, 0.06);
  --line-strong: rgba(170, 180, 196, 0.14);

  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--screen-bg);
}

.screen-header {
  display: flex;
  flex: 0 0 96px;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  height: 96px;
  padding: 0 40px;
}

.brand-title {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.5px;
}

.brand-subtitle {
  margin: 6px 0 0;
  color: var(--screen-text-muted);
  font-size: 14px;
  letter-spacing: 0.2px;
}

.screen-nav {
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
}

.nav-pill {
  display: inline-flex;
  align-items: center;
  height: 42px;
  padding: 0 20px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: rgba(17, 28, 46, 0.6);
  color: var(--screen-text-muted);
  font-size: 14px;
  white-space: nowrap;
}

.nav-pill.is-active {
  border-color: transparent;
  background: var(--accent);
  color: var(--screen-text);
}

.intro-row {
  display: flex;
  flex: 0 0 72px;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  height: 72px;
  padding: 0 40px;
}

.intro-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.intro-subtitle {
  margin: 0;
  color: var(--screen-text-muted);
  font-size: 13px;
}

.map-main {
  display: flex;
  flex: 1;
  gap: 24px;
  min-height: 0;
  padding: 0 40px 24px;
}

.filter-panel {
  display: flex;
  flex: 0 0 280px;
  flex-direction: column;
  width: 280px;
  min-height: 0;
  padding: 24px 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--screen-card);
  overflow-y: auto;
}

.panel-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
}

.filter-group {
  margin-bottom: 24px;
}

.group-label {
  margin: 0 0 10px;
  color: var(--screen-text-muted);
  font-size: 13px;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel-inset);
  color: var(--screen-text-muted);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}

.type-chip.is-active {
  border-color: var(--accent);
  background: rgba(47, 128, 237, 0.16);
  color: var(--screen-text);
}

.select-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel-inset);
  color: var(--screen-text-muted);
  font-size: 13px;
}

.select-chevron {
  width: 8px;
  height: 8px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
}

.reset-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  margin-top: auto;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: transparent;
  color: var(--screen-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.reset-button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--screen-text);
}

.reset-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.type-chip:focus-within {
  box-shadow: 0 0 0 2px rgba(47, 128, 237, 0.5);
}

.type-checkbox {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.select-wrap {
  position: relative;
}

.select-field {
  width: 100%;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.select-field.is-selected {
  color: var(--screen-text);
}

.province-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 30;
  margin: 0;
  padding: 4px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--screen-card);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  list-style: none;
  max-height: 240px;
  overflow-y: auto;
}

.province-menu li {
  margin: 0;
}

.province-option {
  display: flex;
  align-items: center;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--screen-text-muted);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.province-option:hover {
  background: var(--panel-inset);
  color: var(--screen-text);
}

.province-option.is-active {
  background: rgba(47, 128, 237, 0.16);
  color: var(--screen-text);
}

.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel-inset);
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--screen-text);
  font-size: 13px;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--screen-text-muted);
}

.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.search-clear {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--line-strong);
  color: var(--screen-text-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.search-clear:hover {
  color: var(--screen-text);
}

.filter-result {
  margin: -8px 0 14px;
  color: var(--screen-text-muted);
  font-size: 12px;
}
.map-container {
  position: relative;
  flex: 1;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--screen-card);
  overflow: hidden;
}

.map-canvas {
  position: absolute;
  inset: 0;
}

.map-container::before {
  content: '';
  position: absolute;
  inset: 24px;
  border-radius: 10px;
  background: var(--panel-inset);
}

.map-heading {
  position: absolute;
  top: 28px;
  left: 28px;
  z-index: 2;
  pointer-events: none;
}

.map-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.map-subtitle {
  margin: 6px 0 0;
  color: var(--screen-text-muted);
  font-size: 13px;
}

.map-feedback {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  margin: 0;
  padding: 10px 18px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: rgba(17, 28, 46, 0.82);
  color: var(--screen-text-muted);
  font-size: 13px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.map-feedback.is-error {
  border-color: rgba(235, 87, 87, 0.45);
  color: #f2a0a0;
}

.map-caption {
  position: absolute;
  bottom: 20px;
  left: 28px;
  z-index: 2;
  max-width: 980px;
  margin: 0;
  color: rgba(170, 180, 196, 0.75);
  font-size: 12px;
  line-height: 1.5;
  pointer-events: none;
}

.status-bar {
  display: flex;
  flex: 0 0 88px;
  height: 88px;
  padding: 0 40px;
  border-top: 1px solid var(--line);
  background: var(--screen-card);
}

.status-item {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.status-item.has-divider::before {
  content: '';
  position: absolute;
  top: 24px;
  bottom: 24px;
  left: 0;
  width: 1px;
  background: var(--line);
}

.status-value {
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.status-label {
  color: var(--screen-text-muted);
  font-size: 14px;
}

.skeleton {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, #16243a 25%, #1d3150 37%, #16243a 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.status-value-skeleton {
  width: 88px;
  height: 40px;
}

.data-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 18, 32, 0.55);
}

.map-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.skeleton-bubble {
  width: 120px;
  height: 120px;
  border-radius: 50%;
}

.skeleton-line {
  width: 260px;
  height: 16px;
}

.skeleton-line.is-short {
  width: 170px;
}

.data-retry {
  padding: 14px 26px;
  border: 1px solid rgba(235, 87, 87, 0.55);
  border-radius: 10px;
  background: rgba(17, 28, 46, 0.92);
  color: #f2a0a0;
  font-size: 15px;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
}

.data-retry:hover {
  border-color: #eb5757;
  background: rgba(235, 87, 87, 0.14);
  color: #ffffff;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}

.detail-drawer {
  position: absolute;
  top: 96px;
  right: 0;
  bottom: 88px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: 420px;
  border-left: 1px solid var(--line-strong);
  background: var(--screen-card);
  box-shadow: -24px 0 48px rgba(0, 0, 0, 0.45);
  transform: translateX(100%);
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.detail-drawer.is-open {
  transform: translateX(0);
  pointer-events: auto;
}
.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 20px;
  border-bottom: 1px solid var(--line);
}

.drawer-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.drawer-subtitle {
  margin: 6px 0 0;
  color: var(--screen-text-muted);
  font-size: 13px;
}

.drawer-close {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-inset);
  color: var(--screen-text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.drawer-close:hover {
  border-color: var(--accent);
  color: var(--screen-text);
}

.drawer-body {
  flex: 1;
  padding: 8px 24px 24px;
  overflow-y: auto;
}

.drawer-inner {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.drawer-heading {
  flex: 1 1 auto;
  min-width: 0;
}

.drawer-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.city-group + .city-group {
  margin-top: 20px;
}

.city-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
  font-size: 15px;
  font-weight: 600;
}

.city-group-count {
  color: var(--screen-text-muted);
  font-size: 12px;
  font-weight: 400;
}

.institution-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.institution-card {
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-inset);
  transition: border-color 0.2s ease;
}

.institution-card.is-expanded {
  border-color: rgba(47, 128, 237, 0.5);
}

.card-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}

.card-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.card-row .card-summary {
  flex: 1;
  min-width: 0;
}

.card-checkin {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  min-width: 104px;
  margin: 12px 14px 0 0;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--accent);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.card-checkin:hover:not(:disabled) {
  background: #4a93f5;
  box-shadow: 0 0 16px rgba(47, 128, 237, 0.75);
  transform: translateY(-1px);
}

.card-checkin:disabled {
  cursor: not-allowed;
}

.card-checkin.is-lit {
  background: rgba(170, 180, 196, 0.16);
  border-color: var(--line-strong);
  color: var(--screen-text-muted);
}

.card-checkin.is-loading {
  opacity: 0.85;
}

.checkin-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: checkin-spin 0.8s linear infinite;
}

@keyframes checkin-spin {
  to {
    transform: rotate(360deg);
  }
}

.card-name {
  font-size: 15px;
  font-weight: 600;
}

.card-name-en {
  color: var(--screen-text-muted);
  font-size: 12px;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.card-type {
  flex: 0 0 auto;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(47, 128, 237, 0.16);
  color: #9cc4ff;
  font-size: 12px;
  white-space: nowrap;
}

.card-address {
  flex: 1;
  min-width: 0;
  color: var(--screen-text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 16px 14px;
  border-top: 1px dashed var(--line);
}

.card-section-label {
  margin: 6px 0 0;
  color: var(--screen-text-muted);
  font-size: 12px;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-tag {
  padding: 2px 8px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  color: var(--screen-text);
  font-size: 12px;
}

.card-tag.is-empty {
  color: var(--screen-text-muted);
}

.card-description {
  margin: 0;
  color: var(--screen-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.card-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.card-lit-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border: 1px solid rgba(39, 174, 96, 0.55);
  border-radius: 999px;
  background: rgba(39, 174, 96, 0.14);
  color: #7ee2a8;
  font-size: 12px;
  white-space: nowrap;
}

.card-lit-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #27ae60;
  box-shadow: 0 0 6px rgba(39, 174, 96, 0.9);
}

.card-tag.is-ward {
  border-color: rgba(47, 128, 237, 0.55);
  background: rgba(47, 128, 237, 0.16);
  color: #9cc4ff;
}

.card-tag.is-clinic {
  border-color: rgba(39, 174, 96, 0.55);
  background: rgba(39, 174, 96, 0.14);
  color: #7ee2a8;
}

.card-project-list {
  margin: 0;
  padding: 0 0 0 18px;
  color: var(--screen-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.card-project-item {
  margin: 2px 0;
}

.card-detail-empty {
  margin: 6px 0 0;
  color: var(--screen-text-muted);
  font-size: 12px;
}

.drawer-empty {
  margin: 24px 0 0;
  color: var(--screen-text-muted);
  font-size: 13px;
  text-align: center;
}

.toast-stack {
  position: absolute;
  top: 104px;
  right: 40px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  padding: 10px 16px;
  border: 1px solid rgba(39, 174, 96, 0.5);
  border-radius: 8px;
  background: rgba(17, 28, 46, 0.94);
  color: #7ee2a8;
  font-size: 14px;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.38);
}

.toast-item.is-error {
  border-color: rgba(235, 87, 87, 0.55);
  color: #f2a0a0;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.reconnect-banner {
  position: absolute;
  left: 40px;
  bottom: 104px;
  z-index: 60;
  margin: 0;
  padding: 8px 14px;
  border: 1px solid rgba(235, 87, 87, 0.5);
  border-radius: 8px;
  background: rgba(17, 28, 46, 0.92);
  color: #f2a0a0;
  font-size: 13px;
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .detail-drawer {
    transition: none;
  }

  .drawer-fade-enter-active,
  .drawer-fade-leave-active {
    transition: none;
  }
}
</style>
