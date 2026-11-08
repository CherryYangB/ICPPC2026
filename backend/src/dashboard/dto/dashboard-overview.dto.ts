import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AnswerByQuestionDto {
  @ApiProperty({ example: 'q1' })
  questionId!: string

  @ApiProperty({ example: '症状管理' })
  topicZh!: string

  @ApiProperty({ example: '#2f80ed' })
  color!: string

  @ApiProperty({ example: 18 })
  count!: number
}

/** 最近活动：回答 / 打卡合并后的联合结构 */
export class RecentActivityDto {
  @ApiProperty({ enum: ['answer', 'checkin'], example: 'answer' })
  type!: 'answer' | 'checkin'

  @ApiPropertyOptional({ example: 'q1' })
  questionId?: string

  @ApiPropertyOptional({ example: '我们需要更加统一的临床标准……' })
  preview?: string

  @ApiPropertyOptional({ example: 'physician' })
  identityTag?: string

  @ApiPropertyOptional({ example: '深圳市儿童医院' })
  nameZh?: string

  @ApiPropertyOptional({ example: '广东' })
  province?: string

  @ApiProperty({ example: '2026-11-08T15:00:00.000Z' })
  createdAt!: string
}

export class DashboardOverviewDto {
  @ApiProperty({ example: 120 })
  totalAnswers!: number

  @ApiProperty({ example: 15, description: '北京时间（UTC+8）当天回答数' })
  todayAnswers!: number

  @ApiProperty({
    example: 8,
    description: '近 ONLINE_WINDOW_MINUTES 分钟内有答题的去重 clientIp 数',
  })
  onlineCount!: number

  @ApiProperty({ example: 12 })
  litInstitutions!: number

  @ApiProperty({ example: 58 })
  totalInstitutions!: number

  @ApiProperty({ example: 6 })
  litProvinces!: number

  @ApiProperty({ type: [AnswerByQuestionDto] })
  answersByQuestion!: AnswerByQuestionDto[]

  @ApiProperty({ type: [RecentActivityDto] })
  recentActivity!: RecentActivityDto[]
}
