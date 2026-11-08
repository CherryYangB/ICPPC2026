import { Body, Controller, DefaultValuePipe, Get, HttpCode, ParseIntPipe, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'
import { getClientIp } from '../common/utils/client-ip'
import { AnswersService } from './answers.service'
import { CreateAnswerDto } from './dto/create-answer.dto'
import { SubmitAnswerResponseDto } from './dto/submit-answer-response.dto'
import type { NewAnswerEvent } from '../realtime/events'

@Controller('answer')
export class AnswersController {
  constructor(private readonly answersService: AnswersService) {}

  /** 最近答题（供大屏初始化弹幕回放） */
  @Get('recent')
  findRecent(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number): Promise<NewAnswerEvent[]> {
    return this.answersService.findRecent(limit)
  }

  @Post()
  @HttpCode(201)
  submit(
    @Body() dto: CreateAnswerDto,
    @Req() req: Request,
  ): Promise<SubmitAnswerResponseDto> {
    return this.answersService.submit(dto, getClientIp(req))
  }
}