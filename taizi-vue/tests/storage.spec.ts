import { describe, it, expect, beforeEach } from 'vitest'
import {
  STORAGE_KEY,
  MAX_LENGTH,
  DEFAULT_TOPICS,
  PALETTE,
  createSeedPosts,
  normalizePost,
  loadFeed,
  saveFeed,
  type StorageLike,
} from '../src/utils/storage'
import { hueFor } from '../src/utils/format'

/** 基于内存 Map 的 Storage 替身，行为与 localStorage 一致 */
function fakeStorage(): StorageLike & { dump(): string | null } {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    dump: () => (map.has(STORAGE_KEY) ? map.get(STORAGE_KEY)! : null),
  }
}

describe('常量', () => {
  it('输入上限 140 字', () => {
    expect(MAX_LENGTH).toBe(140)
  })

  it('调色板有 7 个色相', () => {
    expect(PALETTE).toHaveLength(7)
  })

  it('默认话题 5 条', () => {
    expect(DEFAULT_TOPICS).toHaveLength(5)
  })
})

describe('createSeedPosts', () => {
  it('3 条示例数据，id 为 seed-1/2/3', () => {
    const seeds = createSeedPosts()
    expect(seeds).toHaveLength(3)
    expect(seeds.map((p) => p.id)).toEqual(['seed-1', 'seed-2', 'seed-3'])
  })

  it('createdAt 互不相同且都小于基准时间', () => {
    const now = 1_000_000_000
    const seeds = createSeedPosts(now)
    const times = seeds.map((p) => p.createdAt)
    expect(new Set(times).size).toBe(3)
    times.forEach((t) => expect(t).toBeLessThan(now))
  })
})

describe('normalizePost：字段校验与兜底', () => {
  it('非对象输入返回 null', () => {
    expect(normalizePost(null)).toBeNull()
    expect(normalizePost('str')).toBeNull()
    expect(normalizePost(42)).toBeNull()
  })

  it('空内容或纯空白内容返回 null', () => {
    expect(normalizePost({ content: '' })).toBeNull()
    expect(normalizePost({ content: '   ' })).toBeNull()
    expect(normalizePost({})).toBeNull()
  })

  it('完整合法字段原样保留', () => {
    const post = normalizePost({
      id: 'p1',
      content: 'hello',
      createdAt: 1234,
      likes: 12,
      liked: true,
      hue: 340,
    })
    expect(post).toEqual({
      id: 'p1',
      content: 'hello',
      createdAt: 1234,
      likes: 12,
      liked: true,
      hue: 340,
    })
  })

  it('超长内容截断到 1000 字符', () => {
    const post = normalizePost({ content: 'a'.repeat(2000) })
    expect(post!.content).toHaveLength(1000)
  })

  it('缺失 id 自动生成', () => {
    const post = normalizePost({ content: 'hello' })
    expect(typeof post!.id).toBe('string')
    expect(post!.id.length).toBeGreaterThan(0)
  })

  it('非法 createdAt 兜底为当前时间', () => {
    const before = Date.now()
    const post = normalizePost({ content: 'x', createdAt: 'abc' })
    expect(post!.createdAt).toBeGreaterThanOrEqual(before)
    expect(post!.createdAt).toBeLessThanOrEqual(Date.now())
  })

  it('createdAt 为负数或 0 兜底', () => {
    expect(normalizePost({ content: 'x', createdAt: -5 })!.createdAt).toBeGreaterThan(0)
    expect(normalizePost({ content: 'x', createdAt: 0 })!.createdAt).toBeGreaterThan(0)
  })

  it('likes 非法时归 0，小数向下取整', () => {
    expect(normalizePost({ content: 'x', likes: -3 })!.likes).toBe(0)
    expect(normalizePost({ content: 'x', likes: NaN })!.likes).toBe(0)
    expect(normalizePost({ content: 'x', likes: 12.9 })!.likes).toBe(12)
  })

  it('liked 只有严格 true 才为真', () => {
    expect(normalizePost({ content: 'x', liked: true })!.liked).toBe(true)
    expect(normalizePost({ content: 'x', liked: 1 })!.liked).toBe(false)
    expect(normalizePost({ content: 'x', liked: 'yes' })!.liked).toBe(false)
  })

  it('hue 归一化到 [0, 360)', () => {
    expect(normalizePost({ content: 'x', hue: 720 })!.hue).toBe(0)
    expect(normalizePost({ content: 'x', hue: -20 })!.hue).toBe(340)
    expect(normalizePost({ content: 'x', hue: 340.6 })!.hue).toBe(341)
  })

  it('缺失 hue 用 FNV-1a 从 id 推导', () => {
    expect(normalizePost({ id: 'seed-1', content: 'x' })!.hue).toBe(hueFor('seed-1'))
  })
})

describe('loadFeed', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('存储为空时写入示例数据并返回 3 条（时间倒序）', () => {
    const storage = fakeStorage()
    const posts = loadFeed(storage)

    expect(posts).toHaveLength(3)
    expect(posts[0].id).toBe('seed-1')
    expect(posts[2].id).toBe('seed-3')

    const saved = JSON.parse(storage.dump()!)
    expect(saved.version).toBe(2)
    expect(saved.posts).toHaveLength(3)
  })

  it('读取 version 2 结构并按时间倒序', () => {
    const storage = fakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        posts: [
          { id: 'a', content: '新', createdAt: 300, likes: 1, liked: false, hue: 340 },
          { id: 'b', content: '旧', createdAt: 100, likes: 9, liked: false, hue: 158 },
          { id: 'c', content: '中', createdAt: 200, likes: 5, liked: false, hue: 205 },
        ],
      }),
    )
    const posts = loadFeed(storage)
    expect(posts.map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('兼容旧版裸数组结构', () => {
    const storage = fakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'old', content: '老数据', createdAt: 1, likes: 0, liked: false, hue: 12 }]),
    )
    const posts = loadFeed(storage)
    expect(posts).toHaveLength(1)
    expect(posts[0].id).toBe('old')
  })

  it('空内容条目被丢弃', () => {
    const storage = fakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        posts: [
          { id: 'a', content: 'ok', createdAt: 1, likes: 0, liked: false, hue: 12 },
          { id: 'b', content: '   ', createdAt: 2, likes: 0, liked: false, hue: 12 },
        ],
      }),
    )
    expect(loadFeed(storage).map((p) => p.id)).toEqual(['a'])
  })

  it('损坏的 JSON 降级为空列表且不抛错', () => {
    const storage = fakeStorage()
    storage.setItem(STORAGE_KEY, '{not-json')
    expect(loadFeed(storage)).toEqual([])
  })

  it('结构异常（posts 不是数组）降级为空列表', () => {
    const storage = fakeStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, posts: 'oops' }))
    expect(loadFeed(storage)).toEqual([])
  })

  it('localStorage 抛异常（隐私模式）时返回内存示例数据', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('quota')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {},
    }
    const posts = loadFeed(storage)
    expect(posts).toHaveLength(3)
  })
})

describe('saveFeed', () => {
  it('以 { version: 2, posts } 结构写入并返回 true', () => {
    const storage = fakeStorage()
    const posts = [{ id: 'a', content: 'hi', createdAt: 1, likes: 0, liked: false, hue: 12 }]
    expect(saveFeed(posts, storage)).toBe(true)
    const saved = JSON.parse(storage.dump()!)
    expect(saved).toEqual({ version: 2, posts })
  })

  it('写入失败时返回 false 且不抛错', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => {},
    }
    expect(saveFeed([], storage)).toBe(false)
  })
})
