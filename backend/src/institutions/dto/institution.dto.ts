import { ApiProperty } from '@nestjs/swagger'

export class InstitutionDto {
  @ApiProperty({ example: 1 })
  id!: number

  @ApiProperty({ example: '广东' })
  province!: string

  @ApiProperty({ example: '深圳市' })
  city!: string

  @ApiProperty({ example: '深圳市儿童医院' })
  nameZh!: string

  @ApiProperty({ example: "Shenzhen Children's Hospital", nullable: true })
  nameEn!: string | null

  @ApiProperty({ example: true })
  hasWard!: boolean

  @ApiProperty({ example: false })
  hasClinic!: boolean

  @ApiProperty({ type: [String], example: ['星星航站合作病房（B栋3A层重症医学科）'] })
  wardProjects!: string[]

  @ApiProperty({ type: [String], example: [] })
  clinicDepartments!: string[]

  @ApiProperty({ type: [String], example: ['ward', 'clinic'] })
  typeTags!: string[]

  @ApiProperty({ example: 114.0579 })
  longitude!: number

  @ApiProperty({ example: 22.5431 })
  latitude!: number

  @ApiProperty({ example: false })
  isLit!: boolean
}
