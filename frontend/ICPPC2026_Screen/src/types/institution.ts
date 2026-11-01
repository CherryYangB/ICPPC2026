/**
 * 大屏机构数据模型（由后端 InstitutionDto 映射而来）。
 * province 为短名（如「广东」「北京」）：气泡按经纬度定位，不依赖地图 GeoJSON 的要素名称；
 * 短名同时用于省份筛选与抽屉分组，保证彼此一致。
 */
export interface Institution {
  /** 机构唯一标识（前端用 string，映射自后端数字 id） */
  id?: string
  /** 机构名称（可选，后续详情抽屉用） */
  name?: string
  /** 省级行政区短名（如「广东」），已去除「省/市/自治区」等后缀 */
  province: string
  /** 市级行政区名称 */
  city: string
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** 展示用类型标签（由 hasWard/hasClinic 推导，如「合作病房」「舒缓门诊」） */
  type: string
  /** 是否具备合作病房（类型筛选用） */
  hasWard?: boolean
  /** 是否具备舒缓门诊（类型筛选用） */
  hasClinic?: boolean
  /** 机构英文名（抽屉卡片副标题，可选） */
  nameEn?: string
  /** 详细地址（抽屉卡片摘要，可选） */
  address?: string
  /** 服务标签（展开详情，可选） */
  tags?: string[]
  /** 机构简介（展开详情，可选） */
  description?: string
  /** 是否已点亮（后端 isLit，可用于发光态渲染） */
  isLit?: boolean
}