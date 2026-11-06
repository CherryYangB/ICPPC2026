import { BadRequestException, Controller, Get, Header, Param } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { QUESTION_IDS } from '../answers/dto/create-answer.dto'
import { WordCloudItemDto } from './dto/wordcloud.dto'
import { WordcloudService, type QuestionId, type WordCloudItem } from './wordcloud.service'

@ApiTags('wordcloud')
@Controller('wordcloud')
export class WordcloudController {
  constructor(private readonly wordcloudService: WordcloudService) {}

  /** 八个问题的词频（固定 q1..q8 八个 key，无数据为 []） */
  @Get()
  @ApiOperation({ summary: '八个问题的词频' })
  @ApiOkResponse({
    description: '固定返回 q1..q8 八个 key，无数据时为空数组',
    schema: {
      example: {
        q1: [{ word: '舒缓疗护', count: 8 }],
        q2: [],
        q3: [],
        q4: [],
        q5: [],
        q6: [],
        q7: [],
        q8: [],
      },
    },
  })
  findAll(): Promise<Record<QuestionId, WordCloudItem[]>> {
    return this.wordcloudService.computeAllWordClouds()
  }

  /** 参与人数（按 clientIp 去重）—— 必须声明在 :questionId 之前，否则会被当成题目 id */
  @Get('participants')
  @Header('Content-Type', 'application/json; charset=utf-8')
  @ApiOperation({ summary: '参与人数（按 clientIp 去重）' })
  @ApiOkResponse({ description: '参与人数（裸数字）', schema: { type: 'number', example: 128 } })
  participants(): Promise<number> {
    return this.wordcloudService.countParticipants()
  }

  /** 单问题答题总数（裸数字，供前端统计卡片直接使用） */
  @Get(':questionId/count')
  @Header('Content-Type', 'application/json; charset=utf-8')
  @ApiOperation({ summary: '单问题答题总数' })
  @ApiParam({ name: 'questionId', enum: [...QUESTION_IDS], example: 'q3' })
  @ApiOkResponse({ description: '答题总数（裸数字）', schema: { type: 'number', example: 42 } })
  async count(@Param('questionId') questionId: string): Promise<number> {
    this.assertQuestionId(questionId)
    return this.wordcloudService.countAnswers(questionId)
  }

  /** 单问题词频 */
  @Get(':questionId')
  @ApiOperation({ summary: '单问题词频' })
  @ApiParam({ name: 'questionId', enum: [...QUESTION_IDS], example: 'q3' })
  @ApiOkResponse({ type: [WordCloudItemDto] })
  async findOne(@Param('questionId') questionId: string): Promise<WordCloudItem[]> {
    this.assertQuestionId(questionId)
    return this.wordcloudService.computeWordCloud(questionId)
  }

  /** 只接受 q1..q8，其余返回 400 */
  private assertQuestionId(value: string): asserts value is QuestionId {
    if (!(QUESTION_IDS as readonly string[]).includes(value)) {
      throw new BadRequestException(`未知的题目 id：${value}`)
    }
  }
}
