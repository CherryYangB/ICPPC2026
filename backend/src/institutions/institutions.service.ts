import { Injectable } from '@nestjs/common'
import { Prisma, type Institution, type ServiceTag } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { INSTITUTION_TYPE_LABELS } from '../common/constants/institution-types'
import { QueryInstitutionsDto } from './dto/query-institutions.dto'
import {
  InstitutionDto,
  InstitutionListResponse,
  ServiceTagDto,
} from './dto/institution.dto'

type InstitutionWithTags = Institution & {
  tags: Array<{ tag: ServiceTag }>
}

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryInstitutionsDto): Promise<InstitutionListResponse> {
    const { page, pageSize, province, city, district, type, keyword, tags, sort } = query

    const where: Prisma.InstitutionWhereInput = {}
    if (province) where.province = province
    if (city) where.city = city
    if (district) where.district = district
    if (type) where.type = type

    if (keyword) {
      where.OR = [
        { nameZh: { contains: keyword } },
        { nameEn: { contains: keyword } },
        { description: { contains: keyword } },
        { descriptionEn: { contains: keyword } },
      ]
    }

    if (tags && tags.length > 0) {
      where.tags = { some: { tag: { nameZh: { in: tags } } } }
    }

    const orderBy: Prisma.InstitutionOrderByWithRelationInput =
      sort === 'createdAt' ? { createdAt: 'desc' } : { nameZh: 'asc' }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.institution.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { tags: { include: { tag: true } } },
      }),
      this.prisma.institution.count({ where }),
    ])

    return {
      data: rows.map((row) => this.toDto(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  private toDto(row: InstitutionWithTags): InstitutionDto {
    const labels = INSTITUTION_TYPE_LABELS[row.type as keyof typeof INSTITUTION_TYPE_LABELS]
    return {
      id: row.id,
      nameZh: row.nameZh,
      nameEn: row.nameEn,
      type: row.type,
      typeZh: labels?.zh ?? row.type,
      typeEn: labels?.en ?? row.type,
      province: row.province,
      city: row.city,
      district: row.district,
      address: row.address,
      description: row.description,
      descriptionEn: row.descriptionEn,
      serviceTags: row.tags.map(
        (link): ServiceTagDto => ({
          id: link.tag.id,
          nameZh: link.tag.nameZh,
          nameEn: link.tag.nameEn,
        }),
      ),
    }
  }
}