import type { SocketMessage } from './types'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '/ws'

export function createSocket(): WebSocket {
  return new WebSocket(SOCKET_URL)
}

export function sendSocketMessage<T>(
  socket: WebSocket,
  message: SocketMessage<T>,
): void {
  socket.send(JSON.stringify(message))
}
