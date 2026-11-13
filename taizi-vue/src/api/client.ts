import type { Post } from '../types'

/** API 根路径：开发期走 Vite 代理，也可用 VITE_API_BASE 覆盖 */
const BASE: string = import.meta.env.VITE_API_BASE ?? '/api'

/** 统一的接口错误：status 为 0 表示网络层失败（请求未到达服务端） */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown }
}

/** 解析错误体，非 JSON 或缺字段时用 HTTP_<status> 与中文兜底 */
async function toApiError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`
  let message = '请求失败，请稍后重试'
  try {
    const body = (await response.json()) as ErrorBody
    const detail = body?.error
    if (detail && typeof detail.code === 'string' && detail.code) code = detail.code
    if (detail && typeof detail.message === 'string' && detail.message) message = detail.message
  } catch {
    // 错误体不是 JSON：保留兜底文案
  }
  return new ApiError(response.status, code, message)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务端，请确认 API 已启动')
  }

  if (!response.ok) throw await toApiError(response)
  // 204 没有 body，绝不能尝试解析 JSON
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** 片语广场的 RESTful 客户端：所有路径都以 /api 为根 */
export const api = {
  health(): Promise<{ status: string; posts: number }> {
    return request<{ status: string; posts: number }>('/health')
  },

  async listPosts(): Promise<Post[]> {
    const data = await request<{ posts: Post[] }>('/posts')
    return data.posts
  },

  getPost(id: string): Promise<Post> {
    return request<Post>(`/posts/${encodeURIComponent(id)}`)
  },

  createPost(content: string): Promise<Post> {
    return request<Post>('/posts', { method: 'POST', body: JSON.stringify({ content }) })
  },

  updatePost(id: string, patch: { content?: string; liked?: boolean; favorited?: boolean }): Promise<Post> {
    return request<Post>(`/posts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },

  /** 点赞：不传 liked 时为切换，传入则为显式设置（幂等） */
  likePost(id: string, liked?: boolean): Promise<Post> {
    return request<Post>(`/posts/${encodeURIComponent(id)}/like`, {
      method: 'POST',
      body: JSON.stringify(liked === undefined ? {} : { liked }),
    })
  },

  /** 收藏：不传 favorited 时为切换，传入则为显式设置（幂等） */
  favoritePost(id: string, favorited?: boolean): Promise<Post> {
    return request<Post>(`/posts/${encodeURIComponent(id)}/favorite`, {
      method: 'POST',
      body: JSON.stringify(favorited === undefined ? {} : { favorited }),
    })
  },

  async deletePost(id: string): Promise<void> {
    await request<void>(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}
