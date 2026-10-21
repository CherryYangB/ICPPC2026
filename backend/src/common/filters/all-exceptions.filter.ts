import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { CooldownException } from '../exceptions/cooldown.exception'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message: string | string[] = 'Internal server error'
    let error = 'Internal Server Error'

    if (exception instanceof CooldownException) {
      status = HttpStatus.TOO_MANY_REQUESTS
      message = '提交过于频繁，请稍后再试'
      error = 'Too Many Requests'
      response.setHeader('Retry-After', String(exception.retryAfterSeconds))
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS
      message = '请求过于频繁，请稍后再试'
      error = 'Too Many Requests'
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>
        message = (r.message as string | string[]) ?? exception.message
        error = (r.error as string) ?? exception.name
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }
}