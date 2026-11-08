import { ApiProperty } from '@nestjs/swagger'

/** 回答管理列表项（不包含 clientIp） */
export class AdminAnswerDto {
  @ApiProperty({ example: 'clx1234567890' })
  id!: string

  @ApiProperty({ example: 'q3' })
  questionId!: string

  @ApiProperty({ example: 'nurse' })
  identityTag!: string

  @ApiProperty({ example: '加强基层儿科舒缓疗护培训' })
  answer!: string

  @ApiProperty({ example: false })
  isHidden!: boolean

  @ApiProperty({
    example: '2026-11-08T14:00:00.000Z',
    description: '对应 Answer.submittedAt（接口契约命名为 createdAt）',
  })
  createdAt!: Date
}

export class PaginatedAdminAnswersDto {
  @ApiProperty({ type: [AdminAnswerDto] })
  items!: AdminAnswerDto[]

  @ApiProperty({ example: 1 })
  total!: number

  @ApiProperty({ example: 1 })
  page!: number

  @ApiProperty({ example: 20 })
  pageSize!: number

  @ApiProperty({ example: 1 })
  totalPages!: number
}

export class AdminAnswerActionResponseDto {
  @ApiProperty({ example: true })
  success!: boolean
}

export class BatchHideAnswersResponseDto {
  @ApiProperty({ example: 3 })
  updated!: number
}

export class BatchDeleteAnswersResponseDto {
  @ApiProperty({ example: 3 })
  deleted!: number
}
