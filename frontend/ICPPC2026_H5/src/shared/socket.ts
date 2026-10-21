import { io, type Socket } from 'socket.io-client'
import type { NewAnswerEvent } from './types'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '/ws'

// 大屏（screen）客户端连接 /ws 命名空间，后端会将其加入 `screens` 房间。
export function createScreenSocket(token?: string): Socket {
  return io(SOCKET_URL, {
    auth: token ? { role: 'screen', token } : { role: 'screen' },
  })
}

export function subscribeNewAnswer(
  socket: Socket,
  handler: (payload: NewAnswerEvent) => void,
): () => void {
  socket.on('newAnswer', handler)
  return () => {
    socket.off('newAnswer', handler)
  }
}
