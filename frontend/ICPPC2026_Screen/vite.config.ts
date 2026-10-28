import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 大屏部署在 http://域名/screen/ 子路径下，base 必须为 '/screen/'，
// 否则构建产物会以 /assets/* 引用，部署后 JS/CSS 全部 404、页面白屏。
// https://vite.dev/config/
export default defineConfig({
  base: '/screen/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 与 H5（默认 5173）区分开，两个前端可同时启动
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 大屏 Socket.io 走相对路径 /ws（命名空间），握手请求在 /socket.io 上
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
