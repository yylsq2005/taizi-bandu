import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 后端服务默认端口，可用 API_PORT 覆盖 */
const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 开发期把 /api 交给 Hono 服务，前端代码里只写相对路径
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.ts', 'server/**/*.spec.ts'],
  },
})
