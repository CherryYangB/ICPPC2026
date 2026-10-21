import { HttpException, HttpStatus } from '@nestjs/common'

export class CooldownException extends HttpException {
  constructor(public readonly retryAfterSeconds: number) {
    super('提交过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS)
  }
}