import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { getClientIp } from '../common/utils/client-ip'
import { AnswersService } from './answers.service'
import { CreateAnswerDto } from './dto/create-answer.dto'
import { SubmitAnswerResponseDto } from './dto/submit-answer-response.dto'

@Controller('answer')
export class AnswersController {
  constructor(private readonly answersService: AnswersService) {}

  @Post()
  @HttpCode(201)
  submit(
    @Body() dto: CreateAnswerDto,
    @Req() req: Request,
  ): Promise<SubmitAnswerResponseDto> {
    return this.answersService.submit(dto, getClientIp(req))
  }
}