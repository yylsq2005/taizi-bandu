import { serve } from '@hono/node-server'
import { createApp } from './app'

const port = Number(process.env.PORT ?? 8787)
const app = createApp()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[太子伴读] 接口服务已启动：http://127.0.0.1:${info.port}`)
})
