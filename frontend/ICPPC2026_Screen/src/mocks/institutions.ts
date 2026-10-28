import type { Institution } from '@/types/institution'

/**
 * 用于地理聚合与筛选验证的 16 条 mock 机构数据：
 * 覆盖 3 个省（广东/江苏/四川）、9 个市，机构类型统一为 6 类筛选口径。
 * 接入真实数据源后删除本文件及引用。
 */
export const MOCK_INSTITUTIONS: Institution[] = [
  { id: 'inst-001', name: '广东省人民医院', nameEn: 'Guangdong Provincial People\u2019s Hospital', province: '广东省', city: '广州市', longitude: 113.2644, latitude: 23.1291, type: '医院', address: '广州市越秀区中山二路106号', tags: ['儿科舒缓', '安宁疗护', '志愿者服务'], description: '华南地区三甲综合医院，率先开展儿童舒缓医疗与家庭支持服务。' },
  { id: 'inst-002', name: '中山大学', nameEn: 'Sun Yat-sen University', province: '广东省', city: '广州市', longitude: 113.3245, latitude: 23.1065, type: '其他', address: '广州市海珠区新港西路135号', tags: ['医学教育', '科研合作'], description: '国内重点高校，设有安宁疗护与人文关怀相关研究团队。' },
  { id: 'inst-003', name: '深圳市人民医院', nameEn: 'Shenzhen People\u2019s Hospital', province: '广东省', city: '深圳市', longitude: 114.0579, latitude: 22.5431, type: '医院', address: '深圳市罗湖区东门北路1017号', tags: ['儿童安宁疗护', '疼痛管理'], description: '深圳市大型三甲医院，开设儿科舒缓门诊与多学科团队。' },
  { id: 'inst-004', name: '深圳先进技术研究院', nameEn: 'Shenzhen Institute of Advanced Technology', province: '广东省', city: '深圳市', longitude: 114.1095, latitude: 22.5502, type: '其他', address: '深圳市南山区学苑大道1068号', tags: ['科研合作', '数据平台'], description: '聚焦生命健康与大数据，为舒缓医疗提供技术支撑。' },
  { id: 'inst-005', name: '东莞市社会组织服务中心', nameEn: 'Dongguan Social Organization Service Center', province: '广东省', city: '东莞市', longitude: 113.7518, latitude: 23.0207, type: '社工机构', address: '东莞市南城街道莞太路', tags: ['社会组织', '家庭支持'], description: '服务本地社会组织，开展家庭照护与社区关怀项目。' },
  { id: 'inst-006', name: '江苏省人民医院', nameEn: 'Jiangsu Province Hospital', province: '江苏省', city: '南京市', longitude: 118.7969, latitude: 32.0603, type: '医院', address: '南京市鼓楼区广州路300号', tags: ['儿科舒缓', '安宁疗护'], description: '华东区域医疗中心，设有儿童舒缓医疗示范病房。' },
  { id: 'inst-007', name: '南京大学', nameEn: 'Nanjing University', province: '江苏省', city: '南京市', longitude: 118.8369, latitude: 32.0435, type: '其他', address: '南京市鼓楼区汉口路22号', tags: ['医学教育', '科研合作'], description: '重点综合性大学，开展生命伦理与临终关怀研究。' },
  { id: 'inst-008', name: '苏州市立医院', nameEn: 'Suzhou Municipal Hospital', province: '江苏省', city: '苏州市', longitude: 120.5853, latitude: 31.2989, type: '医院', address: '苏州市姑苏区道前街26号', tags: ['儿童舒缓', '心理支持'], description: '市级综合医院，提供儿童安宁疗护与心理疏导服务。' },
  { id: 'inst-009', name: '苏州市公益基金会', nameEn: 'Suzhou Public Welfare Foundation', province: '江苏省', city: '苏州市', longitude: 120.6216, latitude: 31.3176, type: '基金会', address: '苏州市姑苏区干将东路', tags: ['公益基金', '项目资助'], description: '资助儿童舒缓与安宁疗护相关公益项目。' },
  { id: 'inst-010', name: '无锡市科技企业', nameEn: 'Wuxi Technology Enterprise', province: '江苏省', city: '无锡市', longitude: 120.3119, latitude: 31.4912, type: '企业', address: '无锡市滨湖区太湖大道', tags: ['企业社会责任', '技术支援'], description: '本地科技企业，为舒缓医疗机构提供信息化支持。' },
  { id: 'inst-011', name: '四川大学华西医院', nameEn: 'West China Hospital, Sichuan University', province: '四川省', city: '成都市', longitude: 104.0665, latitude: 30.5723, type: '医院', address: '成都市武侯区国学巷37号', tags: ['儿科舒缓', '安宁疗护', '培训基地'], description: '西部医疗高地，设有全国儿童舒缓医疗培训基地。' },
  { id: 'inst-012', name: '成都生物研究所', nameEn: 'Chengdu Institute of Biology', province: '四川省', city: '成都市', longitude: 104.0421, latitude: 30.6037, type: '其他', address: '成都市武侯区人民南路四段9号', tags: ['科研合作'], description: '中国科学院下属研究机构，开展相关基础与转化研究。' },
  { id: 'inst-013', name: '绵阳市中心医院', nameEn: 'Mianyang Central Hospital', province: '四川省', city: '绵阳市', longitude: 104.6796, latitude: 31.4675, type: '医院', address: '绵阳市涪城区常青路12号', tags: ['儿童安宁疗护'], description: '区域医疗中心，开设儿童舒缓医疗专科门诊。' },
  { id: 'inst-014', name: '绵阳市政务服务中心', nameEn: 'Mianyang Government Service Center', province: '四川省', city: '绵阳市', longitude: 104.7012, latitude: 31.4891, type: '其他', address: '绵阳市涪城区临园路', tags: ['政府机构', '政策支持'], description: '统筹协调本地安宁疗护与民生服务政策落地。' },
  { id: 'inst-015', name: '德阳市社会组织联合会', nameEn: 'Deyang Federation of Social Organizations', province: '四川省', city: '德阳市', longitude: 104.3979, latitude: 31.1269, type: '社工机构', address: '德阳市旌阳区泰山南路', tags: ['社会组织', '志愿服务'], description: '联合本地社会组织，开展志愿服务与家庭支持活动。' },
  { id: 'inst-016', name: '广州市儿童福利院', nameEn: 'Guangzhou Children Welfare Institute', province: '广东省', city: '广州市', longitude: 113.2988, latitude: 23.1405, type: '儿童福利机构', address: '广州市天河区龙洞街道', tags: ['儿童福利', '家庭寄养'], description: '为孤残儿童提供养育、康复与家庭寄养支持的专业儿童福利机构。' },
]
