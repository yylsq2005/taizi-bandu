/** 单条片语的最大字数（按 Unicode 码点计数） */
export const MAX_LENGTH = 140

/** 每条片语从调色板里取一个色相，保证前后两条颜色不一样 */
export const PALETTE = [340, 268, 205, 158, 35, 12, 300]

export interface Post {
  id: string
  content: string
  createdAt: number
  likes: number
  liked: boolean
  hue: number
}

export type SortMode = 'newest' | 'hot'

export interface ListParams {
  sort?: SortMode
  q?: string
}

export interface CreatePostInput {
  content: string
}

export interface UpdatePostPatch {
  content?: string
  liked?: boolean
}

export type StoreErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND'

/** 业务错误，由 app 层映射成 HTTP 状态码 */
export class StoreError extends Error {
  readonly code: StoreErrorCode

  constructor(code: StoreErrorCode, message: string) {
    super(message)
    this.name = 'StoreError'
    this.code = code
  }
}

export interface PostStore {
  list(params?: ListParams): Post[]
  get(id: string): Post | undefined
  create(input: CreatePostInput): Post
  update(id: string, patch: UpdatePostPatch): Post
  remove(id: string): boolean
  count(): number
}

export interface StoreOptions {
  seed?: boolean
  now?: () => number
  generateId?: () => string
}

/** 与前端 localStorage 时代的示例数据完全一致 */
export function createSeedPosts(now: number = Date.now()): Post[] {
  return [
    {
      id: 'seed-1',
      content: '清晨六点半的操场，风把梧桐叶翻得像书页。今天也要好好读书呀。#今日片语',
      createdAt: now - 12 * 60 * 1000,
      likes: 12,
      liked: false,
      hue: 340,
    },
    {
      id: 'seed-2',
      content:
        '把《长安的荔枝》读完了，合上书那一刻忽然很饿。\n原来最动人的永远是那些笨拙又认真的坚持。#读书笔记',
      createdAt: now - 3 * 60 * 60 * 1000,
      likes: 8,
      liked: false,
      hue: 158,
    },
    {
      id: 'seed-3',
      content: '地铁上听到两个小朋友认真讨论宇宙的尽头，比任何播客都精彩。#通勤路上',
      createdAt: now - 26 * 60 * 60 * 1000,
      likes: 21,
      liked: false,
      hue: 205,
    },
  ]
}

function byNewest(a: Post, b: Post): number {
  return b.createdAt - a.createdAt
}

/** 热度优先，并列时新发布的靠前 */
function byHot(a: Post, b: Post): number {
  return b.likes - a.likes || b.createdAt - a.createdAt
}

/** 统一的正文校验：必须是字符串、trim 后非空、码点数不超过上限 */
function normalizeContent(value: string): string {
  if (typeof value !== 'string') {
    throw new StoreError('VALIDATION_ERROR', '内容必须是字符串')
  }
  const content = value.trim()
  if (!content) {
    throw new StoreError('VALIDATION_ERROR', '内容不能为空')
  }
  if (Array.from(content).length > MAX_LENGTH) {
    throw new StoreError('VALIDATION_ERROR', `最多 ${MAX_LENGTH} 字`)
  }
  return content
}

/** 创建独立的内存仓储，每次调用互不影响 */
export function createPostStore(options: StoreOptions = {}): PostStore {
  const { seed = true, now = () => Date.now(), generateId = () => crypto.randomUUID() } = options
  const posts: Post[] = seed ? createSeedPosts(now()) : []

  return {
    list(params = {}) {
      const { sort = 'newest', q = '' } = params
      const keyword = q.toLowerCase()
      const matched = keyword
        ? posts.filter((post) => post.content.toLowerCase().includes(keyword))
        : posts.slice()
      return matched.sort(sort === 'hot' ? byHot : byNewest)
    },

    get(id) {
      const post = posts.find((item) => item.id === id)
      return post ? { ...post } : undefined
    },

    create(input) {
      const post: Post = {
        id: generateId(),
        content: normalizeContent(input.content),
        createdAt: now(),
        likes: 0,
        liked: false,
        // 按当前已有条数取色，保持「一条一色」的观感
        hue: PALETTE[posts.length % PALETTE.length],
      }
      posts.push(post)
      return { ...post }
    },

    update(id, patch) {
      const post = posts.find((item) => item.id === id)
      if (!post) {
        throw new StoreError('NOT_FOUND', '片语不存在')
      }
      if (patch.content !== undefined) {
        post.content = normalizeContent(patch.content)
      }
      if (patch.liked !== undefined && patch.liked !== post.liked) {
        post.liked = patch.liked
        post.likes = Math.max(0, post.likes + (patch.liked ? 1 : -1))
      }
      return { ...post }
    },

    remove(id) {
      const index = posts.findIndex((item) => item.id === id)
      if (index === -1) {
        return false
      }
      posts.splice(index, 1)
      return true
    },

    count() {
      return posts.length
    },
  }
}
