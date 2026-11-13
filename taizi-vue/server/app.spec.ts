// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { MAX_LENGTH, createPostStore } from './store'
import type { Post, PostStore } from './store'

const NOW = 1_700_000_000_000
const MINUTE = 60 * 1000

type App = ReturnType<typeof createApp>

interface ApiError {
  error: { code: string; message: string }
}

/** 空库 + 固定时钟的测试夹具，用例之间互不影响 */
function createFixture() {
  let clock = NOW
  const store = createPostStore({ seed: false, now: () => clock })
  return {
    store,
    app: createApp({ store }),
    advance(ms: number) {
      clock += ms
    },
  }
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

function postJson(target: App, body: unknown): Promise<Response> {
  return Promise.resolve(
    target.request('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function patchJson(target: App, id: string, body: unknown): Promise<Response> {
  return Promise.resolve(
    target.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

/** 点赞/收藏：body 传 undefined 时不带请求体，用于验证「空 body 即切换」 */
function postAction(
  target: App,
  id: string,
  action: 'like' | 'favorite',
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = { method: 'POST' }
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return Promise.resolve(target.request(`/api/posts/${id}/${action}`, init))
}

let app: App
let store: PostStore

beforeEach(() => {
  const fixture = createFixture()
  app = fixture.app
  store = fixture.store
})

describe('GET /api/health', () => {
  it('返回 ok 与当前条数', async () => {
    const first = await app.request('/api/health')
    expect(first.status).toBe(200)
    expect(first.headers.get('content-type')).toContain('application/json')
    expect(await readJson(first)).toEqual({ status: 'ok', posts: 0 })

    await postJson(app, { content: '一条片语' })
    const second = await readJson<{ status: string; posts: number }>(await app.request('/api/health'))
    expect(second).toEqual({ status: 'ok', posts: 1 })
  })
})

describe('GET /api/posts', () => {
  it('默认按 newest 倒序', async () => {
    const fixture = createFixture()
    await postJson(fixture.app, { content: '较早' })
    fixture.advance(MINUTE)
    await postJson(fixture.app, { content: '较晚' })

    const body = await readJson<{ posts: Post[] }>(await fixture.app.request('/api/posts'))
    expect(body.posts.map((item) => item.content)).toEqual(['较晚', '较早'])
    expect(fixture.store.count()).toBe(2)
  })

  it('sort=hot 按点赞倒序，非法 sort 退回 newest', async () => {
    const fixture = createFixture()
    const first = await readJson<Post>(await postJson(fixture.app, { content: 'A' }))
    fixture.advance(MINUTE)
    const second = await readJson<Post>(await postJson(fixture.app, { content: 'B' }))
    await patchJson(fixture.app, first.id, { liked: true })

    const hot = await readJson<{ posts: Post[] }>(await fixture.app.request('/api/posts?sort=hot'))
    expect(hot.posts.map((item) => item.id)).toEqual([first.id, second.id])

    const newest = await readJson<{ posts: Post[] }>(
      await fixture.app.request('/api/posts?sort=bogus'),
    )
    expect(newest.posts.map((item) => item.id)).toEqual([second.id, first.id])
  })

  it('q 大小写不敏感过滤，可与 hot 叠加', async () => {
    const fixture = createFixture()
    const older = await readJson<Post>(await postJson(fixture.app, { content: 'Reading 时光' }))
    await postJson(fixture.app, { content: '跑步五公里' })
    fixture.advance(MINUTE)
    const newer = await readJson<Post>(await postJson(fixture.app, { content: 'reading 第二篇' }))
    await patchJson(fixture.app, newer.id, { liked: true })

    const byKeyword = await readJson<{ posts: Post[] }>(
      await fixture.app.request('/api/posts?q=READING'),
    )
    expect(byKeyword.posts).toHaveLength(2)

    const hotKeyword = await readJson<{ posts: Post[] }>(
      await fixture.app.request('/api/posts?q=reading&sort=hot'),
    )
    expect(hotKeyword.posts.map((item) => item.id)).toEqual([newer.id, older.id])

    const all = await readJson<{ posts: Post[] }>(await fixture.app.request('/api/posts?q='))
    expect(all.posts).toHaveLength(3)
  })

  it('favorited=true 只返回已收藏，可与 sort、q 叠加', async () => {
    const fixture = createFixture()
    const older = await readJson<Post>(await postJson(fixture.app, { content: 'Reading 第一篇' }))
    fixture.advance(MINUTE)
    await postJson(fixture.app, { content: '跑步五公里' })
    fixture.advance(MINUTE)
    const newer = await readJson<Post>(await postJson(fixture.app, { content: 'reading 第二篇' }))

    const none = await readJson<{ posts: Post[] }>(
      await fixture.app.request('/api/posts?favorited=true'),
    )
    expect(none.posts).toEqual([])

    await postAction(fixture.app, older.id, 'favorite')
    await postAction(fixture.app, newer.id, 'favorite')

    const faved = await readJson<{ posts: Post[] }>(
      await fixture.app.request('/api/posts?favorited=true'),
    )
    expect(faved.posts.map((item) => item.id)).toEqual([newer.id, older.id])
    expect(faved.posts.every((item) => item.favorited)).toBe(true)

    const favedKeyword = await readJson<{ posts: Post[] }>(
      await fixture.app.request('/api/posts?favorited=true&q=READING'),
    )
    expect(favedKeyword.posts.map((item) => item.id)).toEqual([newer.id, older.id])

    await postAction(fixture.app, older.id, 'like', { liked: true })
    const favedHot = await readJson<{ posts: Post[] }>(
      await fixture.app.request('/api/posts?favorited=true&q=reading&sort=hot'),
    )
    expect(favedHot.posts.map((item) => item.id)).toEqual([older.id, newer.id])

    const all = await readJson<{ posts: Post[] }>(await fixture.app.request('/api/posts'))
    expect(all.posts).toHaveLength(3)
  })
})

describe('POST /api/posts', () => {
  it('创建成功返回 201 与完整字段，并出现在列表首位', async () => {
    const res = await postJson(app, { content: '  新的一条  ' })
    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toContain('application/json')

    const created = await readJson<Post>(res)
    expect(created.content).toBe('新的一条')
    expect(typeof created.id).toBe('string')
    expect(created.id.length).toBeGreaterThan(0)
    expect(created.createdAt).toBe(NOW)
    expect(created.likes).toBe(0)
    expect(created.liked).toBe(false)
    expect(created.favorites).toBe(0)
    expect(created.favorited).toBe(false)
    expect(created.hue).toBe(340)

    const list = await readJson<{ posts: Post[] }>(await app.request('/api/posts'))
    expect(list.posts[0]).toEqual(created)
    expect(store.count()).toBe(1)
  })

  it('空白内容返回 400 VALIDATION_ERROR', async () => {
    const res = await postJson(app, { content: '   ' })
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await readJson<ApiError>(res)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('内容不能为空')
  })

  it('141 个码点返回 400', async () => {
    const res = await postJson(app, { content: '字'.repeat(MAX_LENGTH + 1) })
    expect(res.status).toBe(400)
    const body = await readJson<ApiError>(res)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('最多 140 字')
  })

  it('140 个 emoji 按码点计数可以创建', async () => {
    const res = await postJson(app, { content: '😀'.repeat(MAX_LENGTH) })
    expect(res.status).toBe(201)
    expect((await readJson<Post>(res)).content).toBe('😀'.repeat(MAX_LENGTH))
  })

  it('content 非字符串返回 400', async () => {
    expect((await postJson(app, { content: 123 })).status).toBe(400)
    expect((await postJson(app, {})).status).toBe(400)
    expect((await postJson(app, { content: null })).status).toBe(400)
    const body = await readJson<ApiError>(await postJson(app, { content: 1 }))
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /api/posts/:id', () => {
  it('命中返回单条', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '单条' }))
    const res = await app.request(`/api/posts/${created.id}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await readJson<Post>(res)).toEqual(created)
  })

  it('不存在返回 404 NOT_FOUND', async () => {
    const res = await app.request('/api/posts/missing')
    expect(res.status).toBe(404)
    const body = await readJson<ApiError>(res)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBeTruthy()
  })
})

describe('PATCH /api/posts/:id', () => {
  it('liked true/false 联动点赞数，重复设置幂等', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '点赞' }))

    const liked = await readJson<Post>(await patchJson(app, created.id, { liked: true }))
    expect(liked.liked).toBe(true)
    expect(liked.likes).toBe(1)
    expect((await readJson<Post>(await patchJson(app, created.id, { liked: true }))).likes).toBe(1)

    const unliked = await readJson<Post>(await patchJson(app, created.id, { liked: false }))
    expect(unliked.liked).toBe(false)
    expect(unliked.likes).toBe(0)
    expect((await readJson<Post>(await patchJson(app, created.id, { liked: false }))).likes).toBe(0)
  })

  it('favorited true/false 联动收藏数，重复设置幂等且不影响点赞', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '收藏' }))

    const faved = await readJson<Post>(await patchJson(app, created.id, { favorited: true }))
    expect(faved.favorited).toBe(true)
    expect(faved.favorites).toBe(1)
    expect(faved.likes).toBe(0)
    expect((await readJson<Post>(await patchJson(app, created.id, { favorited: true }))).favorites).toBe(
      1,
    )

    const unfaved = await readJson<Post>(await patchJson(app, created.id, { favorited: false }))
    expect(unfaved.favorited).toBe(false)
    expect(unfaved.favorites).toBe(0)
    expect(
      (await readJson<Post>(await patchJson(app, created.id, { favorited: false }))).favorites,
    ).toBe(0)
  })

  it('content 更新成功，140 字边界可用且不动时间与配色', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '旧内容' }))
    const updated = await readJson<Post>(
      await patchJson(app, created.id, { content: '字'.repeat(MAX_LENGTH) }),
    )
    expect(updated.content).toBe('字'.repeat(MAX_LENGTH))
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.hue).toBe(created.hue)
  })

  it('超长、空字符串、空 body、非法 liked 或 favorited 都是 400', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '校验' }))

    const tooLong = await patchJson(app, created.id, { content: '字'.repeat(MAX_LENGTH + 1) })
    expect(tooLong.status).toBe(400)
    expect((await readJson<ApiError>(tooLong)).error.code).toBe('VALIDATION_ERROR')

    expect((await patchJson(app, created.id, { content: '   ' })).status).toBe(400)
    expect((await patchJson(app, created.id, {})).status).toBe(400)
    expect((await patchJson(app, created.id, { liked: 'yes' })).status).toBe(400)
    expect((await patchJson(app, created.id, { favorited: 1 })).status).toBe(400)
    expect((await readJson<ApiError>(await patchJson(app, created.id, { favorited: null }))).error.message).toBe(
      'favorited 必须是布尔值',
    )
  })

  it('未知 id 返回 404', async () => {
    const res = await patchJson(app, 'missing', { liked: true })
    expect(res.status).toBe(404)
    expect((await readJson<ApiError>(res)).error.code).toBe('NOT_FOUND')
  })
})

describe('POST /api/posts/:id/like', () => {
  it('空 body 即切换，返回完整 Post', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '切换点赞' }))

    const res = await postAction(app, created.id, 'like')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const liked = await readJson<Post>(res)
    expect(liked.liked).toBe(true)
    expect(liked.likes).toBe(1)
    expect(liked.id).toBe(created.id)
    expect(liked.content).toBe('切换点赞')
    expect(liked.favorites).toBe(0)

    const toggled = await readJson<Post>(await postAction(app, created.id, 'like'))
    expect(toggled.liked).toBe(false)
    expect(toggled.likes).toBe(0)
  })

  it('显式设置幂等，空对象 body 也能切换', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '显式点赞' }))

    expect((await readJson<Post>(await postAction(app, created.id, 'like', { liked: true }))).likes).toBe(1)
    expect((await readJson<Post>(await postAction(app, created.id, 'like', { liked: true }))).likes).toBe(1)

    const emptyObject = await readJson<Post>(await postAction(app, created.id, 'like', {}))
    expect(emptyObject.liked).toBe(false)
    expect(emptyObject.likes).toBe(0)
  })

  it('liked 非布尔值返回 400 VALIDATION_ERROR', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '校验点赞' }))

    for (const bad of [{ liked: 'yes' }, { liked: 1 }, { liked: null }]) {
      const res = await postAction(app, created.id, 'like', bad)
      expect(res.status).toBe(400)
      const body = await readJson<ApiError>(res)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toBe('liked 必须是布尔值')
    }

    const notObject = await postAction(app, created.id, 'like', [])
    expect(notObject.status).toBe(400)
    expect((await readJson<ApiError>(notObject)).error.code).toBe('VALIDATION_ERROR')
  })

  it('未知 id 返回 404 片语不存在', async () => {
    const res = await postAction(app, 'missing', 'like')
    expect(res.status).toBe(404)
    const body = await readJson<ApiError>(res)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('片语不存在')
  })
})

describe('POST /api/posts/:id/favorite', () => {
  it('空 body 即切换收藏，与点赞计数互不影响', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '切换收藏' }))

    const res = await postAction(app, created.id, 'favorite')
    expect(res.status).toBe(200)
    const faved = await readJson<Post>(res)
    expect(faved.favorited).toBe(true)
    expect(faved.favorites).toBe(1)
    expect(faved.likes).toBe(0)
    expect(faved.liked).toBe(false)

    await postAction(app, created.id, 'like')
    const unFaved = await readJson<Post>(await postAction(app, created.id, 'favorite'))
    expect(unFaved.favorited).toBe(false)
    expect(unFaved.favorites).toBe(0)
    expect(unFaved.likes).toBe(1)
  })

  it('显式设置幂等，重复点击不重复计数', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '显式收藏' }))

    expect((await readJson<Post>(await postAction(app, created.id, 'favorite', { favorited: true }))).favorites).toBe(
      1,
    )
    expect((await readJson<Post>(await postAction(app, created.id, 'favorite', { favorited: true }))).favorites).toBe(
      1,
    )
    expect((await readJson<Post>(await postAction(app, created.id, 'favorite', { favorited: false }))).favorites).toBe(
      0,
    )
    expect((await readJson<Post>(await postAction(app, created.id, 'favorite', { favorited: false }))).favorites).toBe(
      0,
    )
  })

  it('favorited 非布尔值返回 400 VALIDATION_ERROR', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '校验收藏' }))

    for (const bad of [{ favorited: 'yes' }, { favorited: 0 }, { favorited: null }]) {
      const res = await postAction(app, created.id, 'favorite', bad)
      expect(res.status).toBe(400)
      const body = await readJson<ApiError>(res)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toBe('favorited 必须是布尔值')
    }
  })

  it('未知 id 返回 404 片语不存在', async () => {
    const res = await postAction(app, 'missing', 'favorite')
    expect(res.status).toBe(404)
    const body = await readJson<ApiError>(res)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('片语不存在')
  })
})

describe('DELETE /api/posts/:id', () => {
  it('删除返回 204 空 body，随后 GET 与 DELETE 都是 404', async () => {
    const created = await readJson<Post>(await postJson(app, { content: '待删除' }))

    const res = await app.request(`/api/posts/${created.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(res.headers.get('content-type')).toBeNull()

    expect((await app.request(`/api/posts/${created.id}`)).status).toBe(404)
    expect((await app.request(`/api/posts/${created.id}`, { method: 'DELETE' })).status).toBe(404)
  })
})

describe('未匹配路由', () => {
  it('返回 404 JSON 错误结构', async () => {
    const res = await app.request('/api/unknown')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await readJson<ApiError>(res)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('接口不存在')
  })
})

describe('createApp 默认仓储', () => {
  it('不传 store 时自带三条示例片语', async () => {
    const seeded = createApp()
    const body = await readJson<{ posts: Post[] }>(await seeded.request('/api/posts'))
    expect(body.posts.map((item) => item.id)).toEqual(['seed-1', 'seed-2', 'seed-3'])
    expect(body.posts.map((item) => item.favorites)).toEqual([5, 3, 9])
    expect(body.posts.every((item) => item.favorited === false)).toBe(true)
    const health = await readJson<{ posts: number }>(await seeded.request('/api/health'))
    expect(health.posts).toBe(3)
  })
})
