import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../src/api/client', () => {
  class MockApiError extends Error {
    readonly status: number
    readonly code: string

    constructor(status: number, code: string, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.code = code
    }
  }

  return {
    ApiError: MockApiError,
    api: {
      health: vi.fn(),
      listPosts: vi.fn(),
      getPost: vi.fn(),
      createPost: vi.fn(),
      updatePost: vi.fn(),
      deletePost: vi.fn(),
    },
  }
})

import { useFeedStore } from '../src/stores/feed'
import { api } from '../src/api/client'
import type { Post } from '../src/types'

const mocked = vi.mocked(api, true)

function post(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    content: `内容 ${id}`,
    createdAt: 100,
    likes: 0,
    liked: false,
    hue: 340,
    ...overrides,
  }
}

function pending<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mocked.listPosts.mockResolvedValue([])
})

describe('init：从接口载入', () => {
  it('载入列表并按创建时间倒序，loading 有始有终', async () => {
    mocked.listPosts.mockResolvedValue([
      post('b', { createdAt: 100 }),
      post('a', { createdAt: 300 }),
      post('c', { createdAt: 200 }),
    ])

    const store = useFeedStore()
    const loading = store.init()
    expect(store.loading).toBe(true)

    await loading
    expect(store.loading).toBe(false)
    expect(store.posts.map((item) => item.id)).toEqual(['a', 'c', 'b'])
    expect(store.error).toBeNull()
    expect(mocked.listPosts).toHaveBeenCalledTimes(1)
  })

  it('请求失败时记录中文错误且保留原列表', async () => {
    mocked.listPosts.mockResolvedValueOnce([post('a')])
    const store = useFeedStore()
    await store.init()
    expect(store.posts).toHaveLength(1)

    mocked.listPosts.mockRejectedValueOnce(new Error('无法连接服务端，请确认 API 已启动'))
    await store.init()
    expect(store.error).toBe('无法连接服务端，请确认 API 已启动')
    expect(store.posts.map((item) => item.id)).toEqual(['a'])
    expect(store.loading).toBe(false)
  })

  it('reload 重新拉取（窗口重新聚焦时同步其他标签页的改动）', async () => {
    const store = useFeedStore()
    await store.init()
    expect(store.posts).toHaveLength(0)

    mocked.listPosts.mockResolvedValueOnce([post('from-other-tab', { createdAt: 1 })])
    await store.reload()
    expect(store.posts.map((item) => item.id)).toEqual(['from-other-tab'])
  })
})

describe('publish：发布片语', () => {
  it('成功时插入最上方，色相使用服务端返回值', async () => {
    const created = post('srv-1', { content: '我的第一条片语', createdAt: 500, hue: 158 })
    mocked.createPost.mockResolvedValue(created)

    const store = useFeedStore()
    await store.init()

    const result = await store.publish('  我的第一条片语  ')
    expect(result).toEqual({ ok: true, post: created })
    expect(mocked.createPost).toHaveBeenCalledWith('我的第一条片语')
    expect(store.posts[0]).toEqual(created)
    expect(store.posts).toHaveLength(1)
    expect(store.error).toBeNull()
  })

  it('同 id 已存在时替换而不是重复插入', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([post('x', { content: '旧内容' })])
    await store.init()

    const updated = post('x', { content: '新内容' })
    mocked.createPost.mockResolvedValue(updated)
    await store.publish('新内容')

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].content).toBe('新内容')
  })

  it('空白内容不发请求，返回中文提示', async () => {
    const store = useFeedStore()
    await store.init()

    await expect(store.publish('   ')).resolves.toEqual({ ok: false, message: '内容不能为空' })
    expect(mocked.createPost).not.toHaveBeenCalled()
    expect(store.posts).toHaveLength(0)
  })

  it('超过 140 字不发请求；140 字可以提交', async () => {
    const store = useFeedStore()
    await store.init()

    await expect(store.publish('字'.repeat(141))).resolves.toEqual({
      ok: false,
      message: '最多 140 字',
    })
    expect(mocked.createPost).not.toHaveBeenCalled()

    mocked.createPost.mockResolvedValue(post('ok', { content: '字'.repeat(140) }))
    await expect(store.publish('字'.repeat(140))).resolves.toEqual({
      ok: true,
      post: post('ok', { content: '字'.repeat(140) }),
    })
    expect(mocked.createPost).toHaveBeenCalledTimes(1)
  })

  it('服务端拒绝时透传文案，列表不变', async () => {
    const store = useFeedStore()
    await store.init()

    mocked.createPost.mockRejectedValue(new Error('内容不能为空'))
    const result = await store.publish('随便写点')
    expect(result).toEqual({ ok: false, message: '内容不能为空' })
    expect(store.posts).toHaveLength(0)
    expect(store.error).toBe('内容不能为空')
  })
})

describe('toggleLike：点赞与取消', () => {
  it('乐观更新：请求未返回时 UI 已 +1', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([post('a', { likes: 12 })])
    await store.init()

    const { promise, resolve } = pending<Post>()
    mocked.updatePost.mockReturnValue(promise)

    const task = store.toggleLike('a')
    expect(store.posts[0].liked).toBe(true)
    expect(store.posts[0].likes).toBe(13)

    resolve(post('a', { likes: 13, liked: true }))
    await task
    expect(store.posts[0].likes).toBe(13)
    expect(mocked.updatePost).toHaveBeenCalledWith('a', { liked: true })
  })

  it('成功后以服务端返回值覆盖本地', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([post('a', { likes: 12 })])
    await store.init()

    mocked.updatePost.mockResolvedValue(post('a', { likes: 99, liked: true }))
    await store.toggleLike('a')
    expect(store.posts[0]).toMatchObject({ likes: 99, liked: true })
  })

  it('再次点击取消点赞', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([post('a', { likes: 12, liked: true })])
    await store.init()

    mocked.updatePost.mockResolvedValue(post('a', { likes: 11, liked: false }))
    await store.toggleLike('a')
    expect(mocked.updatePost).toHaveBeenCalledWith('a', { liked: false })
    expect(store.posts[0]).toMatchObject({ likes: 11, liked: false })
  })

  it('请求失败时回滚乐观更新并记录错误', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([post('a', { likes: 12 })])
    await store.init()

    mocked.updatePost.mockRejectedValue(new Error('片语不存在'))
    await store.toggleLike('a')

    expect(store.posts[0]).toMatchObject({ likes: 12, liked: false })
    expect(store.error).toBe('片语不存在')
  })

  it('likes 为 0 时取消点赞不会变负数', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([post('a', { likes: 0, liked: true })])
    await store.init()

    mocked.updatePost.mockResolvedValue(post('a', { likes: 0, liked: false }))
    await store.toggleLike('a')
    expect(store.posts[0].likes).toBe(0)
  })

  it('不存在的 id 无副作用且不发请求', async () => {
    const store = useFeedStore()
    await store.init()

    await expect(store.toggleLike('ghost')).resolves.toBeUndefined()
    expect(mocked.updatePost).not.toHaveBeenCalled()
  })
})

describe('removePost：删除', () => {
  it('删除成功后从列表移除', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([
      post('a', { createdAt: 2 }),
      post('b', { createdAt: 1 }),
    ])
    await store.init()

    mocked.deletePost.mockResolvedValue(undefined)
    await expect(store.removePost('a')).resolves.toBe(true)
    expect(mocked.deletePost).toHaveBeenCalledWith('a')
    expect(store.posts.map((item) => item.id)).toEqual(['b'])
    expect(store.error).toBeNull()
  })

  it('删除失败时保留列表并返回 false', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([post('a')])
    await store.init()

    mocked.deletePost.mockRejectedValue(new Error('服务端忙'))
    await expect(store.removePost('a')).resolves.toBe(false)
    expect(store.posts).toHaveLength(1)
    expect(store.error).toBe('服务端忙')
  })

  it('删除不存在的 id 直接返回 true 且不发请求', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockResolvedValueOnce([post('a')])
    await store.init()

    await expect(store.removePost('ghost')).resolves.toBe(true)
    expect(mocked.deletePost).not.toHaveBeenCalled()
    expect(store.posts).toHaveLength(1)
  })
})

describe('visiblePosts：筛选与搜索', () => {
  async function prepare() {
    mocked.listPosts.mockResolvedValueOnce([
      post('newest', { createdAt: 400, likes: 1, content: '梧桐叶黄了 #今日片语' }),
      post('middle', { createdAt: 300, likes: 99, content: '读完一本书 #读书笔记' }),
      post('oldest', { createdAt: 200, likes: 50, content: '地铁见闻 #通勤路上' }),
    ])
    const store = useFeedStore()
    await store.init()
    return store
  }

  it('全部：按时间倒序', async () => {
    const store = await prepare()
    expect(store.visiblePosts.map((item) => item.id)).toEqual(['newest', 'middle', 'oldest'])
  })

  it('热门：按获赞倒序，并列时按时间倒序', async () => {
    const store = await prepare()
    store.setFilter('hot')
    expect(store.visiblePosts.map((item) => item.id)).toEqual(['middle', 'oldest', 'newest'])
  })

  it('搜索：大小写不敏感的子串匹配', async () => {
    const store = await prepare()
    store.setKeyword('梧桐')
    expect(store.visiblePosts.map((item) => item.id)).toEqual(['newest'])
    store.setKeyword('不存在的词')
    expect(store.visiblePosts).toEqual([])
  })

  it('搜索与热门叠加生效', async () => {
    mocked.listPosts.mockResolvedValueOnce([
      post('a', { content: '读书 x', likes: 1, createdAt: 1 }),
      post('b', { content: '读书 y', likes: 9, createdAt: 2 }),
    ])
    const store = useFeedStore()
    await store.init()

    store.setKeyword('读书')
    store.setFilter('hot')
    expect(store.visiblePosts.map((item) => item.id)).toEqual(['b', 'a'])
  })
})

describe('topics：热议榜', () => {
  it('统计各 #话题 条数并按条数倒序', async () => {
    mocked.listPosts.mockResolvedValueOnce([
      post('a', { content: 'x #读书笔记' }),
      post('b', { content: 'y #读书笔记 #深夜书桌' }),
      post('c', { content: 'z #今日片语' }),
    ])
    const store = useFeedStore()
    await store.init()

    expect(store.topics.slice(0, 3)).toEqual([
      { tag: '#读书笔记', count: 2 },
      { tag: '#深夜书桌', count: 1 },
      { tag: '#今日片语', count: 1 },
    ])
  })

  it('不足 5 条时用默认话题补齐，count 为 0', async () => {
    mocked.listPosts.mockResolvedValueOnce([post('a', { content: 'x #读书笔记' })])
    const store = useFeedStore()
    await store.init()

    expect(store.topics).toHaveLength(5)
    expect(store.topics[0]).toEqual({ tag: '#读书笔记', count: 1 })
    expect(store.topics.slice(1).every((item) => item.count === 0)).toBe(true)
    expect(new Set(store.topics.map((item) => item.tag)).size).toBe(5)
  })

  it('同一片语里重复话题只计一次', async () => {
    mocked.listPosts.mockResolvedValueOnce([post('a', { content: '#今日片语 和 #今日片语' })])
    const store = useFeedStore()
    await store.init()
    expect(store.topics[0]).toEqual({ tag: '#今日片语', count: 1 })
  })
})

describe('统计与文案', () => {
  it('totalLikes 为全部片语获赞之和', async () => {
    mocked.listPosts.mockResolvedValueOnce([post('a', { likes: 3 }), post('b', { likes: 4 })])
    const store = useFeedStore()
    await store.init()
    expect(store.totalLikes).toBe(7)
  })

  it('feedLabel 三种状态文案', async () => {
    mocked.listPosts.mockResolvedValueOnce([post('a'), post('b')])
    const store = useFeedStore()
    await store.init()

    expect(store.feedLabel).toBe('2 条片语')
    store.setFilter('hot')
    expect(store.feedLabel).toBe('热门 2 条')
    store.setKeyword('内容 a')
    expect(store.feedLabel).toBe('找到 1 条')
  })
})

describe('视图状态与错误清理', () => {
  it('resetView 清空搜索并回到「全部」', async () => {
    const store = useFeedStore()
    await store.init()
    store.setFilter('hot')
    store.setKeyword('x')
    store.resetView()
    expect(store.filter).toBe('all')
    expect(store.keyword).toBe('')
  })

  it('dismissError 清空错误', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockRejectedValueOnce(new Error('网络炸了'))
    await store.init()
    expect(store.error).toBe('网络炸了')
    store.dismissError()
    expect(store.error).toBeNull()
  })

  it('成功发布会清空上一次的错误', async () => {
    const store = useFeedStore()
    mocked.listPosts.mockRejectedValueOnce(new Error('网络炸了'))
    await store.init()

    mocked.createPost.mockResolvedValue(post('ok'))
    await store.publish('没关系')
    expect(store.error).toBeNull()
  })
})
