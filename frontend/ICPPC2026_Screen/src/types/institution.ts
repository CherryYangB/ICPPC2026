/**
 * 大屏机构数据模型。
 * 当前仅覆盖地理聚合所需字段；province 需与地图 GeoJSON 的 properties.name
 * 保持一致（如「广东省」「北京市」），便于后续气泡与省级要素匹配。
 */
export interface Institution {
  /** 机构唯一标识（可选，后续详情/去重用） */
  id?: string
  /** 机构名称（可选，后续详情抽屉用） */
  name?: string
  /** 省级行政区名称 */
  province: string
  /** 市级行政区名称 */
  city: string
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** 机构类型（6 类口径：医院/儿童福利机构/社工机构/基金会/企业/其他） */
  type: string
  /** 机构英文名（抽屉卡片副标题，可选） */
  nameEn?: string
  /** 详细地址（抽屉卡片摘要，可选） */
  address?: string
  /** 服务标签（展开详情，可选） */
  tags?: string[]
  /** 机构简介（展开详情，可选） */
  description?: string
}
