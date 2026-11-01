import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

import type { Institution } from '@/types/institution'

/** 机构类型筛选口径（与后端 hasWard/hasClinic 对齐） */
export const TYPE_FILTER_OPTIONS = ['安宁疗护病房', '舒缓门诊'] as const

export type InstitutionTypeFilter = (typeof TYPE_FILTER_OPTIONS)[number]

/** 机构是否命中某个类型口径；多选时取并集（具备任一所选类型即可） */
const matchesType = (institution: Institution, type: InstitutionTypeFilter): boolean =>
  type === '安宁疗护病房' ? Boolean(institution.hasWard) : Boolean(institution.hasClinic)

/**
 * 左侧筛选面板状态与过滤逻辑。
 * 三个条件（类型多选 / 省份 / 关键词）之间为 AND 叠加，实时派生过滤后机构集合。
 * - 类型：未勾选 = 全部；勾选后取并集。
 * - 关键词：trim + 大小写不敏感，匹配机构名称（中英文）与简介。
 */
export function useInstitutionFilters(source: MaybeRefOrGetter<Institution[]>) {
  const selectedTypes = ref<InstitutionTypeFilter[]>([])
  const selectedProvince = ref('')
  const keyword = ref('')

  const provinceOptions = computed(() =>
    [...new Set(toValue(source).map((inst) => inst.province))].sort((a, b) => a.localeCompare(b, 'zh')),
  )

  const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())

  const filteredInstitutions = computed<Institution[]>(() => {
    const types = selectedTypes.value
    const province = selectedProvince.value
    const query = normalizedKeyword.value

    return toValue(source).filter((inst) => {
      if (types.length > 0 && !types.some((type) => matchesType(inst, type))) {
        return false
      }
      if (province && inst.province !== province) {
        return false
      }
      if (query) {
        const haystack = [inst.name, inst.nameEn, inst.description]
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.toLowerCase())
        if (!haystack.some((value) => value.includes(query))) {
          return false
        }
      }
      return true
    })
  })

  const hasActiveFilters = computed(
    () => selectedTypes.value.length > 0 || selectedProvince.value !== '' || keyword.value.trim() !== '',
  )

  const resetFilters = () => {
    selectedTypes.value = []
    selectedProvince.value = ''
    keyword.value = ''
  }

  return {
    selectedTypes,
    selectedProvince,
    keyword,
    provinceOptions,
    filteredInstitutions,
    hasActiveFilters,
    resetFilters,
  }
}