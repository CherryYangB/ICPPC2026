import { ApiProperty } from '@nestjs/swagger'

export class ServiceTagDto {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: '临床支持' })
  nameZh: string

  @ApiProperty({ example: 'Clinical support', nullable: true })
  nameEn: string | null
}

export class InstitutionDto {
  @ApiProperty()
  id: string

  @ApiProperty({ example: '北京协和医院儿科' })
  nameZh: string

  @ApiProperty({ example: 'Peking Union Medical College Hospital, Pediatrics', nullable: true })
  nameEn: string | null

  @ApiProperty({ example: 'hospital' })
  type: string

  @ApiProperty({ example: '医院' })
  typeZh: string

  @ApiProperty({ example: 'Hospital' })
  typeEn: string

  @ApiProperty({ example: '北京市' })
  province: string

  @ApiProperty({ example: '北京市' })
  city: string

  @ApiProperty({ example: '东城区', nullable: true })
  district: string | null

  @ApiProperty({ nullable: true })
  address: string | null

  @ApiProperty({ nullable: true })
  description: string | null

  @ApiProperty({ nullable: true })
  descriptionEn: string | null

  @ApiProperty({ type: [ServiceTagDto] })
  serviceTags: ServiceTagDto[]
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface InstitutionListResponse {
  data: InstitutionDto[]
  meta: PaginationMeta
}