const PROVINCE_SUFFIXES = ['特别行政区', '维吾尔自治区', '壮族自治区', '回族自治区', '自治区', '省', '市']

/**
 * 省份规范化：去掉「省 / 市 / 自治区 / 壮族 / 回族 / 维吾尔 / 特别行政区」等后缀。
 * 安徽省 → 安徽；内蒙古自治区 → 内蒙古；广西壮族自治区 → 广西；香港特别行政区 → 香港。
 * 清洗脚本与大屏/H5 的 province 过滤共用同一套规则（GeoJSON 用全名，库里存短名）。
 */
export function normalizeProvince(raw: string): string {
  let name = raw.replace(/\s+/g, '')
  for (const suffix of PROVINCE_SUFFIXES) {
    if (name.length > suffix.length && name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length)
      break
    }
  }
  return name
}
