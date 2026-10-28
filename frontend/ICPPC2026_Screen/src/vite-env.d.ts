/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Socket.io 连接地址，默认 '/ws'（同域命名空间，dev 由 Vite 代理到 localhost:3000） */
  readonly VITE_SOCKET_URL?: string
  /** 大屏握手 token，后端启用 SCREEN_TOKEN 时需要在构建时注入 */
  readonly VITE_SCREEN_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
