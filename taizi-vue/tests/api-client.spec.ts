import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api, ApiError } from '../src/api/client'
import type { Post } from '../src/types'

const sample: Post = {
  id: 'p1',
  content: '你好',
  createdAt: 1,
  likes: 2,
  liked: false,
  favorites: 1,
  favorited: false,
  hue: 340,
}

/** 造一个只实现客户端用到能力的 Response 替身 */
function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 取出第 n 次请求的 url 与 init */
function call(index = 0): { url: string; init: RequestInit } {
  const args = fetchMock.mock.calls[index] as [string, RequestInit]
  return { url: args[0], init: args[1] }
}

describe('api：请求形状', () => {
  it('health 以 GET 请求 /api/health', async () => {
    fetchMock.mockResolvedValue(json({ status: 'ok', posts: 3 }))
    await expect(api.health()).resolves.toEqual({ status: 'ok', posts: 3 })
    expect(call().url).toBe('/api/health')
    expect(call().init.method).toBeUndefined()
  })

  it('listPosts 取 /api/posts 解包 posts 字段', async () => {
    fetchMock.mockResolvedValue(json({ posts: [sample] }))
    await expect(api.listPosts()).resolves.toEqual([sample])
    expect(call().url).toBe('/api/posts')
  })

  it('getPost 按 id 取单条', async () => {
    fetchMock.mockResolvedValue(json(sample))
    await expect(api.getPost('p1')).resolves.toEqual(sample)
    expect(call().url).toBe('/api/posts/p1')
  })

  it('id 会被 encodeURIComponent 编码', async () => {
    fetchMock.mockResolvedValue(json(sample))
    await api.getPost('a/b c')
    expect(call().url).toBe('/api/posts/a%2Fb%20c')
  })

  it('createPost 用 POST + JSON body', async () => {
    fetchMock.mockResolvedValue(json(sample, 201))
    await expect(api.createPost('你好')).resolves.toEqual(sample)
    const { url, init } = call()
    expect(url).toBe('/api/posts')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ content: '你好' }))
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('updatePost 用 PATCH + JSON body', async () => {
    fetchMock.mockResolvedValue(json({ ...sample, liked: true, likes: 3 }))
    await expect(api.updatePost('p1', { liked: true })).resolves.toEqual({
      ...sample,
      liked: true,
      likes: 3,
    })
    const { url, init } = call()
    expect(url).toBe('/api/posts/p1')
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(JSON.stringify({ liked: true }))
  })

  it('likePost 用 POST 请求 /posts/:id/like 并携带显式 liked', async () => {
    fetchMock.mockResolvedValue(json({ ...sample, liked: true, likes: 3 }))
    await expect(api.likePost('p1', true)).resolves.toMatchObject({ liked: true, likes: 3 })
    const { url, init } = call()
    expect(url).toBe('/api/posts/p1/like')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ liked: true }))
  })

  it('likePost 省略参数时发送空对象，交给服务端切换', async () => {
    fetchMock.mockResolvedValue(json({ ...sample, liked: true, likes: 3 }))
    await api.likePost('p1')
    expect(call().init.body).toBe('{}')
  })

  it('favoritePost 用 POST 请求 /posts/:id/favorite 并携带 favorited', async () => {
    fetchMock.mockResolvedValue(json({ ...sample, favorited: true, favorites: 2 }))
    await expect(api.favoritePost('p1', true)).resolves.toMatchObject({ favorited: true, favorites: 2 })
    const { url, init } = call()
    expect(url).toBe('/api/posts/p1/favorite')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ favorited: true }))
  })

  it('favoritePost 省略参数时用空对象切换', async () => {
    fetchMock.mockResolvedValue(json(sample))
    await api.favoritePost('p1')
    expect(call().init.body).toBe('{}')
  })

  it('deletePost 用 DELETE，204 不解析 body', async () => {
    const jsonSpy = vi.fn(() => {
      throw new Error('204 不应该解析 JSON')
    })
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: jsonSpy } as unknown as Response)
    await expect(api.deletePost('p1')).resolves.toBeUndefined()
    expect(call().url).toBe('/api/posts/p1')
    expect(call().init.method).toBe('DELETE')
    expect(jsonSpy).not.toHaveBeenCalled()
  })
})

describe('api：错误处理', () => {
  it('404 抛出 ApiError 并透传 code 与 message', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 'NOT_FOUND', message: '片语不存在' } }, 404),
    )

    const error = await api.getPost('ghost').catch((err: unknown) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toBeInstanceOf(Error)
    const apiError = error as ApiError
    expect(apiError.status).toBe(404)
    expect(apiError.code).toBe('NOT_FOUND')
    expect(apiError.message).toBe('片语不存在')
    expect(apiError.name).toBe('ApiError')
  })

  it('校验失败 400 透传 VALIDATION_ERROR', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 'VALIDATION_ERROR', message: '最多 140 字' } }, 400),
    )
    const error = (await api.createPost('x').catch((err: unknown) => err)) as ApiError
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('最多 140 字')
  })

  it('错误体不是 JSON 时用 HTTP_<status> 与中文兜底', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    } as unknown as Response)

    const error = (await api.listPosts().catch((err: unknown) => err)) as ApiError
    expect(error.status).toBe(500)
    expect(error.code).toBe('HTTP_500')
    expect(error.message).toBe('请求失败，请稍后重试')
  })

  it('错误体缺字段时同样兜底', async () => {
    fetchMock.mockResolvedValue(json({ error: {} }, 503))
    const error = (await api.health().catch((err: unknown) => err)) as ApiError
    expect(error.code).toBe('HTTP_503')
    expect(error.message).toBe('请求失败，请稍后重试')
  })

  it('网络中断映射为 status 0 / NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = (await api.listPosts().catch((err: unknown) => err)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toContain('无法连接服务端')
  })

  it('DELETE 失败同样抛 ApiError', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 'NOT_FOUND', message: '片语不存在' } }, 404))
    await expect(api.deletePost('ghost')).rejects.toBeInstanceOf(ApiError)
  })

  it('每个请求都带 Content-Type: application/json', async () => {
    fetchMock.mockResolvedValue(json({ posts: [] }))
    await api.listPosts()
    expect((call().init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })
})
