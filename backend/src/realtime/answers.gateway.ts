import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import type { NewAnswerEvent } from './events'

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
  server: Server

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
    this.server.to('screens').emit('newAnswer', payload)
  }
}