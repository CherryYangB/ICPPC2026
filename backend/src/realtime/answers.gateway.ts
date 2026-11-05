import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import type { InstitutionCheckinEvent, NewAnswerEvent, WordCloudUpdateEvent } from './events'

/**
 * /ws 命名空间的共享网关：
 * - newAnswer：答题弹幕（立即广播）
 * - wordCloudUpdate：词云更新（由 WordcloudScheduler 每 5 秒节流广播）
 * - checkin：机构打卡（仅首次点亮时广播）
 * 三者都只发给 screens 房间。
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: (origin, callback) => {
      const allowed = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (!origin || allowed.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    },
    credentials: true,
  },
})
export class AnswersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(AnswersGateway.name)
  private readonly screenToken: string

  constructor(config: ConfigService) {
    this.screenToken = config.get<string>('screenToken', '')
  }

  handleConnection(client: Socket): void {
    const role = client.handshake.auth?.role
    if (role !== 'screen') return

    if (this.screenToken && client.handshake.auth?.token !== this.screenToken) {
      this.logger.warn(`Screen client rejected (invalid token): ${client.id}`)
      client.disconnect(true)
      return
    }

    void client.join('screens')
    this.logger.log(`Screen client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket): void {
    void client.leave('screens')
  }

  broadcastNewAnswer(payload: NewAnswerEvent): void {
    if (!this.server) return
    this.server.to('screens').emit('newAnswer', payload)
  }

  /** 词云更新：由 WordcloudScheduler 节流调用（每 5 秒最多一次/问题） */
  broadcastWordCloudUpdate(
    questionId: string,
    words: Array<{ word: string; count: number }>,
  ): void {
    if (!this.server) return

    const payload: WordCloudUpdateEvent = {
      questionId,
      words,
      timestamp: new Date().toISOString(),
    }
    this.server.to('screens').emit('wordCloudUpdate', payload)
  }

  broadcastCheckin(payload: InstitutionCheckinEvent): void {
    if (!this.server) return
    this.server.to('screens').emit('checkin', payload)
  }
}
