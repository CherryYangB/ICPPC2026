import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

import type { Institution } from '@/types/institution'

/** 机构类型筛选口径（6 类） */
export const TYPE_FILTER_OPTIONS = ['医院', '儿童福利机构', '社工机构', '基金会', '企业', '其他'] as const

export type InstitutionTypeFilter = (typeof TYPE_FILTER_OPTIONS)[number]

const TYPE_SET: ReadonlySet<string> = new Set<string>(TYPE_FILTER_OPTIONS)

/** 把机构原始 type 归一为筛选口径；未登记类型兜底归入「其他」 */
export const typeOf = (institution: Institution): InstitutionTypeFilter =>
  TYPE_SET.has(institution.type) ? (institution.type as InstitutionTypeFilter) : '其他'

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
      if (types.length > 0 && !types.includes(typeOf(inst))) {
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
