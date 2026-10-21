import { Transform, Type } from 'class-transformer'
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator'
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'
import { INSTITUTION_TYPES, type InstitutionType } from '../../common/constants/institution-types'

export class QueryInstitutionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  province?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  district?: string

  @IsOptional()
  @IsIn([...INSTITUTION_TYPES])
  type?: InstitutionType

  @IsOptional()
  @IsString()
  keyword?: string

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined
    const arr = Array.isArray(value) ? value : [value]
    return arr
      .flatMap((v) => String(v).split(','))
      .map((s) => s.trim())
      .filter(Boolean)
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @IsOptional()
  @Type(() => String)
  @IsIn(['nameZh', 'createdAt'])
  sort: 'nameZh' | 'createdAt' = 'nameZh'
}