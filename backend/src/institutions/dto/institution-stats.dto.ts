import { ApiProperty } from '@nestjs/swagger'

export class InstitutionStatsDto {
  @ApiProperty({ example: 72 })
  totalInstitutions!: number

  @ApiProperty({ example: 0 })
  litInstitutions!: number

  @ApiProperty({ example: 0 })
  litProvinces!: number

  @ApiProperty({ example: 0 })
  litCities!: number
}
