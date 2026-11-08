import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator'

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value
}

/** 可选文本：空串 / 纯空白 → null，便于清空字段 */
function trimOrNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export class CreateInstitutionDto {
  @ApiProperty({ example: '广东', description: '省份短名；传全名也会归一（广东省 → 广东）' })
  @Transform(trimString)
  @IsString()
  @Length(1, 32)
  province!: string

  @ApiProperty({ example: '深圳市' })
  @Transform(trimString)
  @IsString()
  @Length(1, 64)
  city!: string

  @ApiProperty({ example: '深圳市儿童医院' })
  @Transform(trimString)
  @IsString()
  @Length(1, 128)
  nameZh!: string

  @ApiPropertyOptional({ example: "Shenzhen Children's Hospital", nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 256)
  nameEn?: string | null

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  hasWard?: boolean

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  hasClinic?: boolean

  @ApiPropertyOptional({ type: [String], example: ['星星航站合作病房'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  wardProjects?: string[]

  @ApiPropertyOptional({ type: [String], example: ['舒缓门诊'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  clinicDepartments?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['ward', 'clinic'],
    description: '不传时按 hasWard / hasClinic 自动生成',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(['ward', 'clinic'], { each: true })
  typeTags?: string[]

  @ApiProperty({ example: 114.0579, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number

  @ApiProperty({ example: 22.5431, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number

  @ApiPropertyOptional({ example: '深圳市福田区益田路7019号', nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 256)
  address?: string | null

  @ApiPropertyOptional({ example: '国家儿童区域医疗中心。', nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 2000)
  description?: string | null

  @ApiPropertyOptional({ example: 'National Children’s Regional Medical Center.', nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 2000)
  descriptionEn?: string | null
}
