import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Institution } from '@/types/institution'

/** 地图下钻层级 */
export type GeoLevel = 'province' | 'city'

/** 省级聚合气泡 */
export interface ProvinceBubble {
  province: string
  count: number
  lng: number
  lat: number
}

/** 市级聚合气泡（保留所属省份） */
export interface CityBubble {
  city: string
  province: string
  count: number
  lng: number
  lat: number
}

export interface GeoAggregation {
  provinceBubbles: ProvinceBubble[]
  cityBubbles: CityBubble[]
}

interface Accumulator {
  count: number
  lngSum: number
  latSum: number
}

/** 经纬度保留 4 位小数（约 11 米），保证控制台/回归对比稳定 */
const roundCoord = (value: number): number => Math.round(value * 1e4) / 1e4

const isPlottable = (institution: Institution): boolean =>
  Number.isFinite(institution.longitude) && Number.isFinite(institution.latitude)

/**
 * 将机构数组按省份/城市聚合为气泡坐标（取组内经纬度算术平均）。
 * - 没有机构的省/市不会生成气泡。
 * - 缺少省份名或坐标为非有限数的记录会被跳过。
 * - 同名城市以「省份 + 城市」为组合键区分，不会跨省合并。
 */
export function aggregateInstitutions(institutions: readonly Institution[]): GeoAggregation {
  const provinceMap = new Map<string, Accumulator>()
  const cityMap = new Map<string, Accumulator & { province: string; city: string }>()

  for (const institution of institutions) {
    const province = institution.province?.trim()
    if (!province || !isPlottable(institution)) {
      continue
    }

    const provinceAcc = provinceMap.get(province) ?? { count: 0, lngSum: 0, latSum: 0 }
    provinceAcc.count += 1
    provinceAcc.lngSum += institution.longitude
    provinceAcc.latSum += institution.latitude
    provinceMap.set(province, provinceAcc)

    const city = institution.city?.trim()
    if (!city) {
      continue
    }
    const key = `${province}\u0000${city}`
    const cityAcc = cityMap.get(key) ?? { province, city, count: 0, lngSum: 0, latSum: 0 }
    cityAcc.count += 1
    cityAcc.lngSum += institution.longitude
    cityAcc.latSum += institution.latitude
    cityMap.set(key, cityAcc)
  }

  const provinceBubbles: ProvinceBubble[] = [...provinceMap.entries()].map(([province, acc]) => ({
    province,
    count: acc.count,
    lng: roundCoord(acc.lngSum / acc.count),
    lat: roundCoord(acc.latSum / acc.count),
  }))

  const cityBubbles: CityBubble[] = [...cityMap.entries()].map(([, acc]) => ({
    city: acc.city,
    province: acc.province,
    count: acc.count,
    lng: roundCoord(acc.lngSum / acc.count),
    lat: roundCoord(acc.latSum / acc.count),
  }))

  return { provinceBubbles, cityBubbles }
}

/**
 * 响应式聚合封装；入参可以是 ref、getter 或普通数组。
 */
export function useGeoAggregation(source: MaybeRefOrGetter<Institution[]>) {
  const aggregation = computed(() => aggregateInstitutions(toValue(source)))
  const provinceBubbles = computed(() => aggregation.value.provinceBubbles)
  const cityBubbles = computed(() => aggregation.value.cityBubbles)
  return { provinceBubbles, cityBubbles }
}
