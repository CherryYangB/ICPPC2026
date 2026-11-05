import { ApiProperty } from '@nestjs/swagger'

/** 词云中的一项：词条（或归一目标词）+ 出现次数 */
export class WordCloudItemDto {
  @ApiProperty({ example: '舒缓疗护', description: '归一目标词；没有目标词时为原词条' })
  word!: string

  @ApiProperty({ example: 8, description: '出现次数（按回答中出现次数累计）' })
  count!: number
}
