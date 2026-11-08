import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma, type Institution } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { normalizeProvince } from '../common/utils/province'
import { AnswersGateway } from '../realtime/answers.gateway'
import type { InstitutionCheckinEvent } from '../realtime/events'
import { CreateInstitutionDto } from './dto/create-institution.dto'
import { UpdateInstitutionDto } from './dto/update-institution.dto'
import { SetInstitutionLitDto } from './dto/set-institution-lit.dto'
import { InstitutionLitResponseDto } from './dto/institution-lit-response.dto'
import { QueryInstitutionsDto } from './dto/query-institutions.dto'
import { InstitutionDto } from './dto/institution.dto'
import { InstitutionStatsDto } from './dto/institution-stats.dto'
import { CheckinResponseDto } from './dto/checkin-response.dto'

/** Json 列读出来是 Prisma.JsonValue，统一转成 string[] 返回给前端 */
function toArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

/** typeTags 由 hasWard / hasClinic 推导，保持与清洗脚本一致 */
function deriveTypeTags(hasWard: boolean, hasClinic: boolean): string[] {
  const tags: string[] = []
  if (hasWard) tags.push('ward')
  if (hasClinic) tags.push('clinic')
  return tags
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
   * 已点亮 / 10s 防刷窗口内 / 并发抢占失败 → alreadyLit（不广播），
   * 但同样返回机构信息与实时统计，前端据此提示「已点亮」并刷新 KPI。
   */
  async checkin(id: number): Promise<CheckinResponseDto> {
    const institution = await this.prisma.institution.findUnique({ where: { id } })
    if (!institution) {
      throw new NotFoundException('机构不存在')
    }

    const now = Date.now()
    const last = this.lastCheckinAt.get(id)
    const cooling = last !== undefined && now - last < this.checkinCooldownMs

    // 已点亮 / 10s 防刷窗口内：不广播（避免多屏重复触发发光动画），但仍返回实时统计
    if (cooling || institution.isLit) {
      this.lastCheckinAt.set(id, now)
      const stats = await this.getStats()
      const event = this.toCheckinEvent(institution, stats)
      return this.buildCheckinResponse(event, true, institution.litAt)
    }

    const litAt = new Date()
    const updated = await this.prisma.institution.updateMany({
      where: { id, isLit: false },
      data: { isLit: true, litAt },
    })
    if (updated.count === 0) {
      // 并发下已被其它请求点亮：同样不广播
      this.lastCheckinAt.set(id, now)
      const stats = await this.getStats()
      const event = this.toCheckinEvent(institution, stats)
      return this.buildCheckinResponse(event, true, institution.litAt)
    }

    await this.recordCheckin(institution)

    const stats = await this.getStats()
    // REST 响应与 WS 广播共用同一份字段，保证两边逐字段一致
    const event = this.toCheckinEvent(institution, stats)

    try {
      this.gateway.broadcastCheckin(event)
    } catch (err) {
      this.logger.error('Failed to broadcast checkin', err instanceof Error ? err.stack : String(err))
    }

    this.lastCheckinAt.set(id, now)

    return this.buildCheckinResponse(event, false, litAt)
  }

  /** 新增机构（后台）：唯一约束冲突返回 409 */
  async create(dto: CreateInstitutionDto): Promise<InstitutionDto> {
    const hasWard = dto.hasWard ?? false
    const hasClinic = dto.hasClinic ?? false

    try {
      const row = await this.prisma.institution.create({
        data: {
          province: normalizeProvince(dto.province),
          city: dto.city.trim(),
          nameZh: dto.nameZh.trim(),
          nameEn: dto.nameEn?.trim() || null,
          hasWard,
          hasClinic,
          wardProjects: dto.wardProjects ?? [],
          clinicDepartments: dto.clinicDepartments ?? [],
          typeTags: dto.typeTags ?? deriveTypeTags(hasWard, hasClinic),
          longitude: dto.longitude,
          latitude: dto.latitude,
          address: dto.address?.trim() || null,
          description: dto.description?.trim() || null,
          descriptionEn: dto.descriptionEn?.trim() || null,
        },
      })
      return this.toDto(row)
    } catch (err) {
      this.rethrowDuplicate(err)
      throw err
    }
  }

  /** 编辑机构（后台）：部分更新；isLit / litAt 只能走 setLit */
  async update(id: number, dto: UpdateInstitutionDto): Promise<InstitutionDto> {
    const existing = await this.findInstitutionOrThrow(id)
    const data: Prisma.InstitutionUpdateInput = {}

    if (dto.province !== undefined) data.province = normalizeProvince(dto.province)
    if (dto.city !== undefined) data.city = dto.city.trim()
    if (dto.nameZh !== undefined) data.nameZh = dto.nameZh.trim()
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn?.trim() || null
    if (dto.hasWard !== undefined) data.hasWard = dto.hasWard
    if (dto.hasClinic !== undefined) data.hasClinic = dto.hasClinic
    if (dto.wardProjects !== undefined) data.wardProjects = dto.wardProjects
    if (dto.clinicDepartments !== undefined) data.clinicDepartments = dto.clinicDepartments
    if (dto.typeTags !== undefined) {
      data.typeTags = dto.typeTags
    } else if (dto.hasWard !== undefined || dto.hasClinic !== undefined) {
      data.typeTags = deriveTypeTags(
        dto.hasWard ?? existing.hasWard,
        dto.hasClinic ?? existing.hasClinic,
      )
    }
    if (dto.longitude !== undefined) data.longitude = dto.longitude
    if (dto.latitude !== undefined) data.latitude = dto.latitude
    if (dto.address !== undefined) data.address = dto.address?.trim() || null
    if (dto.description !== undefined) data.description = dto.description?.trim() || null
    if (dto.descriptionEn !== undefined) {
      data.descriptionEn = dto.descriptionEn?.trim() || null
    }

    try {
      const row = await this.prisma.institution.update({
        where: { id: existing.id },
        data,
      })
      return this.toDto(row)
    } catch (err) {
      this.rethrowDuplicate(err)
      throw err
    }
  }

  /** 删除机构（后台）：打卡状态随机构行一起删除；已点亮时通知大屏撤销发光 */
  async remove(id: number): Promise<{ success: boolean }> {
    const existing = await this.findInstitutionOrThrow(id)
    await this.prisma.institution.delete({ where: { id: existing.id } })
    if (existing.isLit) {
      this.tryBroadcastRevoked(existing.id, existing.province)
    }
    return { success: true }
  }

  /** 后台手动设置打卡状态：true → 点亮并广播 checkin；false → 撤销并广播 checkinRevoked */
  async setLit(id: number, dto: SetInstitutionLitDto): Promise<InstitutionLitResponseDto> {
    const existing = await this.findInstitutionOrThrow(id)

    if (dto.isLit) {
      const litAt = new Date()
      const updated = await this.prisma.institution.update({
        where: { id: existing.id },
        data: { isLit: true, litAt },
      })
      this.lastCheckinAt.set(id, litAt.getTime())
      await this.recordCheckin(updated)

      const stats = await this.getStats()
      const event = this.toCheckinEvent(updated, stats)
      try {
        this.gateway.broadcastCheckin(event)
      } catch (err) {
        this.logger.error(
          'Failed to broadcast checkin',
          err instanceof Error ? err.stack : String(err),
        )
      }

      return {
        success: true,
        institutionId: updated.id,
        isLit: true,
        litAt: litAt.toISOString(),
      }
    }

    const updated = await this.prisma.institution.update({
      where: { id: existing.id },
      data: { isLit: false, litAt: null },
    })
    this.lastCheckinAt.delete(id)
    this.tryBroadcastRevoked(updated.id, updated.province)

    return {
      success: true,
      institutionId: updated.id,
      isLit: false,
      litAt: null,
    }
  }

  private async findInstitutionOrThrow(id: number): Promise<Institution> {
    const institution = await this.prisma.institution.findUnique({ where: { id } })
    if (!institution) {
      throw new NotFoundException('机构不存在')
    }
    return institution
  }

  /** 记录一次打卡历史；失败只记日志，不影响打卡主流程 */
  private async recordCheckin(institution: Institution): Promise<void> {
    try {
      await this.prisma.checkinRecord.create({
        data: {
          institutionId: institution.id,
          province: institution.province,
          city: institution.city,
          nameZh: institution.nameZh,
        },
      })
    } catch (err) {
      this.logger.error(
        'Failed to record checkin',
        err instanceof Error ? err.stack : String(err),
      )
    }
  }

  private rethrowDuplicate(err: unknown): void {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException('该省份/城市下已存在同名机构')
    }
  }

  private tryBroadcastRevoked(institutionId: number, province: string): void {
    try {
      this.gateway.broadcastCheckinRevoked({ institutionId, province })
    } catch (err) {
      this.logger.error(
        'Failed to broadcast checkinRevoked',
        err instanceof Error ? err.stack : String(err),
      )
    }
  }

  /**
   * REST 响应与 WS 广播共用的业务字段（唯一数据源）。
   * 广播只在首次点亮时发生，因此这里的 alreadyLit 恒为 false，由调用方按需覆盖。
   */
  private toCheckinEvent(
    institution: Institution,
    stats: InstitutionStatsDto,
  ): InstitutionCheckinEvent {
    return {
      success: true,
      alreadyLit: false,
      institutionId: institution.id,
      nameZh: institution.nameZh,
      province: institution.province,
      city: institution.city,
      litInstitutions: stats.litInstitutions,
      litProvinces: stats.litProvinces,
      litCities: stats.litCities,
    }
  }

  /** 打卡响应统一结构：首次点亮 / 已点亮 / 冷却中都能拿到机构信息与实时统计 */
  private buildCheckinResponse(
    event: InstitutionCheckinEvent,
    alreadyLit: boolean,
    litAt: Date | null,
  ): CheckinResponseDto {
    return { ...event, alreadyLit, litAt: litAt ? litAt.toISOString() : null }
  }

  private toDto(row: Institution): InstitutionDto {
    return {
      id: row.id,
      province: row.province,
      city: row.city,
      nameZh: row.nameZh,
      nameEn: row.nameEn,
      address: row.address,
      description: row.description,
      descriptionEn: row.descriptionEn,
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
