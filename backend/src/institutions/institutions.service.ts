import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma, type Institution } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { normalizeProvince } from '../common/utils/province'
import { AnswersGateway } from '../realtime/answers.gateway'
import type { InstitutionCheckinEvent } from '../realtime/events'
import { QueryInstitutionsDto } from './dto/query-institutions.dto'
import { InstitutionDto } from './dto/institution.dto'
import { InstitutionStatsDto } from './dto/institution-stats.dto'
import { CheckinResponseDto } from './dto/checkin-response.dto'

/** Json 列读出来是 Prisma.JsonValue，统一转成 string[] 返回给前端 */
function toArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

/** id 升序 = 清洗脚本写入顺序（原表按省份分组），保证列表稳定可预测 */
const ORDER_BY: Prisma.InstitutionOrderByWithRelationInput = { id: 'asc' }

const DEFAULT_CHECKIN_COOLDOWN_MS = 10000

@Injectable()
export class InstitutionsService {
  private readonly logger = new Logger(InstitutionsService.name)
  private readonly checkinCooldownMs: number
  /** 机构 ID → 上次打卡时间戳（毫秒），用于 10s 防刷 */
  private readonly lastCheckinAt = new Map<number, number>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AnswersGateway,
    config: ConfigService,
  ) {
    this.checkinCooldownMs = config.get<number>('checkinCooldownMs', DEFAULT_CHECKIN_COOLDOWN_MS)
  }

  /** 全量返回，type / province / keyword 三条件 AND 叠加 */
  async findAll(query: QueryInstitutionsDto): Promise<InstitutionDto[]> {
    const { type, province, keyword } = query
    const where: Prisma.InstitutionWhereInput = {}

    if (type === 'ward') {
      where.hasWard = true
    } else if (type === 'clinic') {
      where.hasClinic = true
    }
    if (province) {
      where.province = normalizeProvince(province)
    }
    if (keyword) {
      where.OR = [{ nameZh: { contains: keyword } }, { nameEn: { contains: keyword } }]
    }

    const rows = await this.prisma.institution.findMany({ where, orderBy: ORDER_BY })
    return rows.map(this.toDto, this)
  }

  /** 机构总量 + 已点亮数量（省/市按去重计数） */
  async getStats(): Promise<InstitutionStatsDto> {
    const [total, lit] = await Promise.all([
      this.prisma.institution.count(),
      this.prisma.institution.findMany({
        where: { isLit: true },
        select: { province: true, city: true },
      }),
    ])

    const provinces = new Set<string>()
    const cities = new Set<string>()
    for (const row of lit) {
      provinces.add(row.province)
      cities.add(row.city)
    }

    return {
      totalInstitutions: total,
      litInstitutions: lit.length,
      litProvinces: provinces.size,
      litCities: cities.size,
    }
  }

  /** 大屏初始化发光状态用 */
  async findCheckedIn(): Promise<InstitutionDto[]> {
    const rows = await this.prisma.institution.findMany({
      where: { isLit: true },
      orderBy: ORDER_BY,
    })
    return rows.map(this.toDto, this)
  }

  /**
   * 机构打卡：isLit = true + litAt = now。
   * 已点亮 / 10s 防刷窗口内 / 并发抢占失败 → alreadyLit（不广播）。
   */
  async checkin(id: number): Promise<CheckinResponseDto> {
    const now = Date.now()
    const last = this.lastCheckinAt.get(id)
    if (last !== undefined && now - last < this.checkinCooldownMs) {
      return { alreadyLit: true }
    }

    const institution = await this.prisma.institution.findUnique({ where: { id } })
    if (!institution) {
      throw new NotFoundException('机构不存在')
    }

    if (institution.isLit) {
      this.lastCheckinAt.set(id, now)
      return { alreadyLit: true }
    }

    const litAt = new Date()
    const updated = await this.prisma.institution.updateMany({
      where: { id, isLit: false },
      data: { isLit: true, litAt },
    })
    if (updated.count === 0) {
      // 并发下已被其它请求点亮，避免重复广播
      this.lastCheckinAt.set(id, now)
      return { alreadyLit: true }
    }

    const stats = await this.getStats()
    const payload: InstitutionCheckinEvent = {
      institutionId: institution.id,
      province: institution.province,
      city: institution.city,
      nameZh: institution.nameZh,
      litInstitutions: stats.litInstitutions,
      litProvinces: stats.litProvinces,
    }

    try {
      this.gateway.broadcastCheckin(payload)
    } catch (err) {
      this.logger.error('Failed to broadcast checkin', err instanceof Error ? err.stack : String(err))
    }

    this.lastCheckinAt.set(id, now)

    return {
      alreadyLit: false,
      institutionId: institution.id,
      litAt: litAt.toISOString(),
      litInstitutions: stats.litInstitutions,
      litProvinces: stats.litProvinces,
    }
  }

  private toDto(row: Institution): InstitutionDto {
    return {
      id: row.id,
      province: row.province,
      city: row.city,
      nameZh: row.nameZh,
      nameEn: row.nameEn,
      hasWard: row.hasWard,
      hasClinic: row.hasClinic,
      wardProjects: toArray(row.wardProjects),
      clinicDepartments: toArray(row.clinicDepartments),
      typeTags: toArray(row.typeTags),
      longitude: row.longitude,
      latitude: row.latitude,
      isLit: row.isLit,
    }
  }
}
