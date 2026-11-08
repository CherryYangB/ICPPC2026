import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 管理后台部署在 http://域名/admin/ 子路径下，base 必须为 '/admin/'，
// 否则构建产物会以 /assets/* 引用，部署后 JS/CSS 全部 404、页面白屏。
// https://vite.dev/config/
export default defineConfig({
  base: '/admin/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 与 H5（默认 5173）、大屏（5174）区分开，三个前端可同时启动
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
