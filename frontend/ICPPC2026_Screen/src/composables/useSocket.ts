import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue'
import { io, type Socket } from 'socket.io-client'

/**
 * 大屏 Socket.io 连接封装。
 *
 * - 开发：走相对路径 '/ws'（命名空间），握手请求 /socket.io 由 Vite 代理到
 *   http://localhost:3000，避免跨域与后端 CORS 配置。
 * - 生产：同域 '/ws'，由 nginx 把 /socket.io 反代到后端（需支持 WebSocket Upgrade）。
 *
 * 后端 @WebSocketGateway 监听的是命名空间 '/ws'，大屏握手需带 auth.role = 'screen'
 * 才会被加入 `screens` 房间并收到 newAnswer 推送。
 */
export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? '/ws'
export const SOCKET_PATH = '/socket.io'

type AnyHandler = (...args: any[]) => void

const socketRef = shallowRef<Socket | null>(null)
const connected = ref(false)

let refCount = 0

function createSocket(): Socket {
  const token = import.meta.env.VITE_SCREEN_TOKEN
  const socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    auth: {
      role: 'screen',
      ...(token ? { token } : {}),
    },
  })

  socket.on('connect', () => {
    connected.value = true
    console.info(`[socket] connected: ${socket.id}`)
  })

  socket.on('disconnect', (reason) => {
    connected.value = false
    console.info(`[socket] disconnected: ${reason}`)
  })

  socket.on('connect_error', (error) => {
    connected.value = false
    console.warn(`[socket] connect_error: ${error.message}`)
  })

  return socket
}

function ensureSocket(): Socket {
  const current = socketRef.value ?? createSocket()
  socketRef.value = current
  if (!current.connected) current.connect()
  return current
}

function releaseSocket(): void {
  const current = socketRef.value
  if (!current) return
  current.removeAllListeners()
  current.disconnect()
  socketRef.value = null
  connected.value = false
}

export function useSocket() {
  const cleanups: Array<() => void> = []
  let acquired = false

  /** 建立（或复用）连接；返回共享的 socket 实例 */
  const connect = (): Socket => {
    const socket = ensureSocket()
    if (!acquired) {
      acquired = true
      refCount += 1
    }
    return socket
  }

  /** 解除本实例注册的事件；最后一个使用者解除时断开连接 */
  const disconnect = (): void => {
    if (!acquired) return
    cleanups.splice(0).forEach((cleanup) => cleanup())
    acquired = false
    refCount = Math.max(0, refCount - 1)
    if (refCount === 0) releaseSocket()
  }

  /** 订阅事件，返回解绑函数；调用时会自动建立连接 */
  const on = <Args extends unknown[]>(
    event: string,
    handler: (...args: Args) => void,
  ): (() => void) => {
    const socket = connect()
    const listener = handler as AnyHandler
    socket.on(event, listener)

    const off = (): void => {
      socket.off(event, listener)
      const index = cleanups.indexOf(off)
      if (index !== -1) cleanups.splice(index, 1)
    }
    cleanups.push(off)
    return off
  }

  // 在组件 / effect scope 内使用时自动清理，组件外调用不会触发警告
  if (getCurrentScope()) {
    onScopeDispose(disconnect)
  }

  return {
    socket: socketRef,
    connected,
    connect,
    disconnect,
    on,
  }
}
