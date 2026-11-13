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

/**
 * 读取可选的 JSON 对象请求体：空请求体视为 `{}`，不算错误。
 * 点赞/收藏接口支持「不传 body 即切换」，因此不能直接复用 readJsonBody。
 */
async function readOptionalJsonBody(c: Context): Promise<Record<string, unknown>> {
  let raw: string
  try {
    raw = await c.req.text()
  } catch {
    throw new StoreError('VALIDATION_ERROR', '请求体不是合法的 JSON')
  }
  if (!raw.trim()) {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new StoreError('VALIDATION_ERROR', '请求体不是合法的 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new StoreError('VALIDATION_ERROR', '请求体必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}

/** 解析 body 里的布尔字段：缺省返回 undefined（表示切换），非布尔值抛校验错误 */
function readFlag(
  body: Record<string, unknown>,
  field: 'liked' | 'favorited',
): boolean | undefined {
  if (!(field in body)) {
    return undefined
  }
  const value = body[field]
  if (typeof value !== 'boolean') {
    throw new StoreError('VALIDATION_ERROR', `${field} 必须是布尔值`)
  }
  return value
}

/** 解析 `favorited` 查询参数：只认 true / false，其它值视为不过滤 */
function parseFavoritedFilter(raw: string | undefined): boolean | undefined {
  if (raw === 'true') {
    return true
  }
  if (raw === 'false') {
    return false
  }
  return undefined
}

export function createApp(options: CreateAppOptions = {}): Hono {
  const store = options.store ?? createPostStore()
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok', posts: store.count() }))

  app.get('/api/posts', (c) => {
    const sort: SortMode = c.req.query('sort') === 'hot' ? 'hot' : 'newest'
    const q = c.req.query('q') ?? ''
    const favorited = parseFavoritedFilter(c.req.query('favorited'))
    return c.json({ posts: store.list({ sort, q, favorited }) })
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
    const hasFavorited = 'favorited' in body
    if (!hasContent && !hasLiked && !hasFavorited) {
      throw new StoreError('VALIDATION_ERROR', '至少提供 content、liked 或 favorited')
    }
    if (hasLiked && typeof body.liked !== 'boolean') {
      throw new StoreError('VALIDATION_ERROR', 'liked 必须是布尔值')
    }
    if (hasFavorited && typeof body.favorited !== 'boolean') {
      throw new StoreError('VALIDATION_ERROR', 'favorited 必须是布尔值')
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
    if (typeof body.favorited === 'boolean') {
      patch.favorited = body.favorited
    }
    return c.json(store.update(c.req.param('id'), patch))
  })

  app.post('/api/posts/:id/like', async (c) => {
    const body = await readOptionalJsonBody(c)
    const liked = readFlag(body, 'liked')
    return c.json(store.toggleLike(c.req.param('id'), liked))
  })

  app.post('/api/posts/:id/favorite', async (c) => {
    const body = await readOptionalJsonBody(c)
    const favorited = readFlag(body, 'favorited')
    return c.json(store.toggleFavorite(c.req.param('id'), favorited))
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
