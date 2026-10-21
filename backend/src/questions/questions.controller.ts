import { createHash } from 'node:crypto'
import { Controller, Get, Res } from '@nestjs/common'
import type { Response } from 'express'
import { QuestionsService } from './questions.service'
import { QuestionDto } from './dto/question.dto'

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  async findAll(@Res({ passthrough: true }) res: Response): Promise<QuestionDto[]> {
    const questions = await this.questionsService.findAll()
    const etag = createHash('md5').update(JSON.stringify(questions)).digest('hex')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('ETag', `"${etag}"`)
    return questions
  }
}