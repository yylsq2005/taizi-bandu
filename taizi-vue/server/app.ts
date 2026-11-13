import { Hono } from 'hono'
import type { Context } from 'hono'
import { StoreError, createPostStore } from './store'
import type { PostStore, SortMode, UpdatePostPatch } from './store'

export interface CreateAppOptions {
  /** 不传则使用带示例数据的内存仓储 */
  store?: PostStore
}

const ERROR_STATUS: Record<'VALIDATION_ERROR' | 'NOT_FOUND', 400 | 404> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
}

function sendError(c: Context, code: string, message: string, status: 400 | 404 | 500) {
  return c.json({ error: { code, message } }, status)
}

/** 读取 JSON 对象请求体，格式不对统一按校验错误处理 */
async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = await c.req.json()
  } catch {
    throw new StoreError('VALIDATION_ERROR', '请求体不是合法的 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new StoreError('VALIDATION_ERROR', '请求体必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}

export function createApp(options: CreateAppOptions = {}): Hono {
  const store = options.store ?? createPostStore()
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok', posts: store.count() }))

  app.get('/api/posts', (c) => {
    const sort: SortMode = c.req.query('sort') === 'hot' ? 'hot' : 'newest'
    const q = c.req.query('q') ?? ''
    return c.json({ posts: store.list({ sort, q }) })
  })

  app.get('/api/posts/:id', (c) => {
    const post = store.get(c.req.param('id'))
    if (!post) {
      throw new StoreError('NOT_FOUND', '片语不存在')
    }
    return c.json(post)
  })

  app.post('/api/posts', async (c) => {
    const body = await readJsonBody(c)
    if (typeof body.content !== 'string') {
      throw new StoreError('VALIDATION_ERROR', '内容必须是字符串')
    }
    return c.json(store.create({ content: body.content }), 201)
  })

  app.patch('/api/posts/:id', async (c) => {
    const body = await readJsonBody(c)
    const hasContent = 'content' in body
    const hasLiked = 'liked' in body
    if (!hasContent && !hasLiked) {
      throw new StoreError('VALIDATION_ERROR', '至少提供 content 或 liked')
    }
    if (hasLiked && typeof body.liked !== 'boolean') {
      throw new StoreError('VALIDATION_ERROR', 'liked 必须是布尔值')
    }
    if (hasContent && typeof body.content !== 'string') {
      throw new StoreError('VALIDATION_ERROR', '内容必须是字符串')
    }

    const patch: UpdatePostPatch = {}
    if (typeof body.content === 'string') {
      patch.content = body.content
    }
    if (typeof body.liked === 'boolean') {
      patch.liked = body.liked
    }
    return c.json(store.update(c.req.param('id'), patch))
  })

  app.delete('/api/posts/:id', (c) => {
    if (!store.remove(c.req.param('id'))) {
      throw new StoreError('NOT_FOUND', '片语不存在')
    }
    // 204 不带 body，也不带 Content-Type
    return new Response(null, { status: 204 })
  })

  app.notFound((c) => sendError(c, 'NOT_FOUND', '接口不存在', 404))

  app.onError((err, c) => {
    if (err instanceof StoreError) {
      return sendError(c, err.code, err.message, ERROR_STATUS[err.code])
    }
    return sendError(c, 'INTERNAL_ERROR', '服务器内部错误', 500)
  })

  return app
}
