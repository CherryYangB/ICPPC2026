import { Transform } from 'class-transformer'
import { IsIn, IsOptional, IsString } from 'class-validator'

/** 机构类型筛选：ward = 有合作病房，clinic = 有舒缓门诊 */
export const INSTITUTION_TYPE_FILTERS = ['ward', 'clinic'] as const
export type InstitutionTypeFilter = (typeof INSTITUTION_TYPE_FILTERS)[number]

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value
}

export class QueryInstitutionsDto {
  @IsOptional()
  @IsIn(INSTITUTION_TYPE_FILTERS)
  type?: InstitutionTypeFilter

  @IsOptional()
  @Transform(trimString)
  @IsString()
  province?: string

  @IsOptional()
  @Transform(trimString)
  @IsString()
  keyword?: string
}
