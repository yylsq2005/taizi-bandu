import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFeedStore } from '../src/stores/feed'
import { STORAGE_KEY } from '../src/utils/storage'
import { hueFor } from '../src/utils/format'

function seedStorage(items: unknown) {
  window.localStorage.setItem(
    STORAGE_KEY,
    typeof items === 'string' ? items : JSON.stringify({ version: 2, posts: items }),
  )
}

function post(id: string, overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
})

describe('init：初始化与持久化', () => {
  it('localStorage 为空时载入 3 条示例数据（时间倒序）', () => {
    const store = useFeedStore()
    store.init()
    expect(store.posts).toHaveLength(3)
    expect(store.posts[0].id).toBe('seed-1')
    expect(store.posts[1].id).toBe('seed-2')
    expect(store.posts[2].id).toBe('seed-3')
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('已有数据时按时间倒序载入', () => {
    seedStorage([
      post('a', { createdAt: 300 }),
      post('b', { createdAt: 100 }),
      post('c', { createdAt: 200 }),
    ])
    const store = useFeedStore()
    store.init()
    expect(store.posts.map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('损坏数据载入为空列表不抛错', () => {
    seedStorage('{oops')
    const store = useFeedStore()
    store.init()
    expect(store.posts).toEqual([])
  })
})

describe('publish：发布片语', () => {
  it('发布成功：插入最上方、likes=0、色相从调色板按序取', () => {
    const store = useFeedStore()
    store.init()
    const count = store.posts.length

    const result = store.publish('  我的第一条片语  ')
    expect(result).not.toBeNull()
    expect(result!.saved).toBe(true)

    expect(store.posts).toHaveLength(count + 1)
    const newPost = store.posts[0]
    expect(newPost.content).toBe('我的第一条片语')
    expect(newPost.likes).toBe(0)
    expect(newPost.liked).toBe(false)
    expect(newPost.createdAt).toBeGreaterThan(0)
    expect(newPost.hue).toBe(158) // PALETTE[3]：3 条 seed 之后取第 4 个色相
  })

  it('色相按发布顺序循环取调色板', () => {
    const store = useFeedStore()
    store.init()
    // 3 条 seed → 第一次发布取 PALETTE[3]=158，第二次取 PALETTE[4]=35
    store.publish('第一条')
    expect(store.posts[0].hue).toBe(158)
    store.publish('第二条')
    expect(store.posts[0].hue).toBe(35)
    expect(store.posts[0].id).not.toBe(store.posts[1].id)
    expect(store.posts[0].createdAt).toBeGreaterThanOrEqual(store.posts[1].createdAt)
  })

  it('发布后写入 localStorage，结构含 version 2', () => {
    const store = useFeedStore()
    store.init()
    store.publish('持久化测试')
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
    expect(saved.version).toBe(2)
    expect(saved.posts.some((p: { content: string }) => p.content === '持久化测试')).toBe(true)
  })

  it('空白内容返回 null 且不新增', () => {
    const store = useFeedStore()
    store.init()
    const before = store.posts.length
    expect(store.publish('   ')).toBeNull()
    expect(store.posts).toHaveLength(before)
  })

  it('超过 140 字返回 null', () => {
    const store = useFeedStore()
    store.init()
    expect(store.publish('字'.repeat(141))).toBeNull()
    expect(store.publish('字'.repeat(140))).not.toBeNull()
  })
})

describe('toggleLike：点赞与取消', () => {
  it('点赞后 liked=true、likes+1 并持久化', () => {
    const store = useFeedStore()
    store.init()
    const id = store.posts[0].id
    store.toggleLike(id)
    const target = store.posts.find((p) => p.id === id)!
    expect(target.liked).toBe(true)
    expect(target.likes).toBe(13) // seed-1 初始 12
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
    expect(saved.posts.find((p: { id: string }) => p.id === id).likes).toBe(13)
  })

  it('再次点击取消点赞', () => {
    const store = useFeedStore()
    store.init()
    const id = store.posts[0].id
    store.toggleLike(id)
    store.toggleLike(id)
    const target = store.posts.find((p) => p.id === id)!
    expect(target.liked).toBe(false)
    expect(target.likes).toBe(12)
  })

  it('likes 为 0 时取消点赞不会变负数', () => {
    seedStorage([post('a', { likes: 0 })])
    const store = useFeedStore()
    store.init()
    store.toggleLike('a')
    store.toggleLike('a')
    expect(store.posts[0].likes).toBe(0)
  })

  it('不存在的 id 无副作用', () => {
    const store = useFeedStore()
    store.init()
    expect(() => store.toggleLike('ghost')).not.toThrow()
  })
})

describe('removePost：删除', () => {
  it('删除后列表与持久化同步更新', () => {
    seedStorage([post('a', { createdAt: 2 }), post('b', { createdAt: 1 })])
    const store = useFeedStore()
    store.init()
    store.removePost('a')
    expect(store.posts.map((p) => p.id)).toEqual(['b'])
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
    expect(saved.posts.map((p: { id: string }) => p.id)).toEqual(['b'])
  })

  it('删除不存在的 id 无副作用', () => {
    seedStorage([post('a')])
    const store = useFeedStore()
    store.init()
    store.removePost('ghost')
    expect(store.posts).toHaveLength(1)
  })
})

describe('visiblePosts：筛选与搜索', () => {
  function prepare() {
    seedStorage([
      post('newest', { createdAt: 400, likes: 1, content: '梧桐叶黄了 #今日片语' }),
      post('middle', { createdAt: 300, likes: 99, content: '读完一本书 #读书笔记' }),
      post('oldest', { createdAt: 200, likes: 50, content: '地铁见闻 #通勤路上' }),
    ])
    const store = useFeedStore()
    store.init()
    return store
  }

  it('全部：按时间倒序', () => {
    const store = prepare()
    expect(store.visiblePosts.map((p) => p.id)).toEqual(['newest', 'middle', 'oldest'])
  })

  it('热门：按获赞倒序，并列时按时间倒序', () => {
    const store = prepare()
    store.setFilter('hot')
    expect(store.visiblePosts.map((p) => p.id)).toEqual(['middle', 'oldest', 'newest'])
  })

  it('搜索：大小写不敏感的子串匹配', () => {
    seedStorage([
      post('a', { content: 'Hello World', createdAt: 2 }),
      post('b', { content: '你好世界', createdAt: 1 }),
    ])
    const store = useFeedStore()
    store.init()
    store.setKeyword('hello')
    expect(store.visiblePosts.map((p) => p.id)).toEqual(['a'])
    store.setKeyword('世界')
    expect(store.visiblePosts.map((p) => p.id)).toEqual(['b'])
  })

  it('搜索与热门叠加生效', () => {
    seedStorage([
      post('a', { content: '读书 x', likes: 1, createdAt: 1 }),
      post('b', { content: '读书 y', likes: 9, createdAt: 2 }),
    ])
    const store = useFeedStore()
    store.init()
    store.setKeyword('读书')
    store.setFilter('hot')
    expect(store.visiblePosts.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('无匹配结果为空数组', () => {
    const store = prepare()
    store.setKeyword('不存在的词')
    expect(store.visiblePosts).toEqual([])
  })
})

describe('topics：热议榜', () => {
  it('统计各 #话题 条数并按条数倒序', () => {
    seedStorage([
      post('a', { content: 'x #读书笔记' }),
      post('b', { content: 'y #读书笔记 #深夜书桌' }),
      post('c', { content: 'z #今日片语' }),
    ])
    const store = useFeedStore()
    store.init()
    expect(store.topics.slice(0, 3)).toEqual([
      { tag: '#读书笔记', count: 2 },
      { tag: '#深夜书桌', count: 1 },
      { tag: '#今日片语', count: 1 },
    ])
  })

  it('不足 5 条时用默认话题补齐，count 为 0', () => {
    seedStorage([post('a', { content: 'x #读书笔记' })])
    const store = useFeedStore()
    store.init()
    expect(store.topics).toHaveLength(5)
    expect(store.topics[0]).toEqual({ tag: '#读书笔记', count: 1 })
    const rest = store.topics.slice(1)
    expect(rest.every((t) => t.count === 0)).toBe(true)
    // 补齐话题来自默认列表且不重复
    const tags = store.topics.map((t) => t.tag)
    expect(new Set(tags).size).toBe(5)
  })

  it('同一片语里重复话题只计一次', () => {
    seedStorage([post('a', { content: '#今日片语 和 #今日片语' })])
    const store = useFeedStore()
    store.init()
    expect(store.topics[0]).toEqual({ tag: '#今日片语', count: 1 })
  })
})

describe('统计与文案', () => {
  it('totalLikes 为全部片语获赞之和', () => {
    seedStorage([post('a', { likes: 3 }), post('b', { likes: 4 })])
    const store = useFeedStore()
    store.init()
    expect(store.totalLikes).toBe(7)
  })

  it('feedLabel 三种状态文案', () => {
    seedStorage([post('a'), post('b')])
    const store = useFeedStore()
    store.init()
    expect(store.feedLabel).toBe('2 条片语')
    store.setFilter('hot')
    expect(store.feedLabel).toBe('热门 2 条')
    store.setKeyword('内容 a')
    expect(store.feedLabel).toBe('找到 1 条')
  })
})

describe('resetView 与 reload', () => {
  it('resetView 清空搜索并回到「全部」', () => {
    const store = useFeedStore()
    store.init()
    store.setFilter('hot')
    store.setKeyword('x')
    store.resetView()
    expect(store.filter).toBe('all')
    expect(store.keyword).toBe('')
  })

  it('reload 从 localStorage 重新载入（模拟多标签页同步）', () => {
    const store = useFeedStore()
    store.init()
    expect(store.posts).toHaveLength(3)
    seedStorage([post('from-other-tab', { createdAt: 1 })])
    store.reload()
    expect(store.posts.map((p) => p.id)).toEqual(['from-other-tab'])
  })

  it('色相推导函数可用（FNV-1a 一致性）', () => {
    expect(hueFor('seed-1')).toBe(hueFor('seed-1'))
  })

  it('publish 生成的 id 互不相同', () => {
    const store = useFeedStore()
    store.init()
    store.publish('a')
    store.publish('b')
    expect(store.posts[0].id).not.toBe(store.posts[1].id)
  })
})
