// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_LENGTH, PALETTE, StoreError, createPostStore, createSeedPosts } from './store'

const NOW = 1_700_000_000_000
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** 空库 + 固定时钟，保证用例之间互不影响 */
function emptyStore() {
  return createPostStore({ seed: false, now: () => NOW })
}

describe('常量', () => {
  it('最大字数与调色板和前端一致', () => {
    expect(MAX_LENGTH).toBe(140)
    expect(PALETTE).toEqual([340, 268, 205, 158, 35, 12, 300])
  })
})

describe('createSeedPosts', () => {
  it('生成三条与前端一致的示例片语', () => {
    const posts = createSeedPosts(NOW)
    expect(posts).toHaveLength(3)
    expect(posts.map((post) => post.id)).toEqual(['seed-1', 'seed-2', 'seed-3'])
    expect(posts.map((post) => post.hue)).toEqual([340, 158, 205])
    expect(posts.map((post) => post.likes)).toEqual([12, 8, 21])
    expect(posts.map((post) => post.createdAt)).toEqual([
      NOW - 12 * MINUTE,
      NOW - 3 * HOUR,
      NOW - 26 * HOUR,
    ])
    expect(posts.every((post) => post.liked === false)).toBe(true)
    expect(posts[0].content).toBe(
      '清晨六点半的操场，风把梧桐叶翻得像书页。今天也要好好读书呀。#今日片语',
    )
    expect(posts[1].content).toContain('\n原来最动人的永远是那些笨拙又认真的坚持。#读书笔记')
    expect(posts[2].content).toBe('地铁上听到两个小朋友认真讨论宇宙的尽头，比任何播客都精彩。#通勤路上')
  })
})

describe('createPostStore', () => {
  it('默认写入三条示例，list 按时间倒序', () => {
    const store = createPostStore({ now: () => NOW })
    expect(store.count()).toBe(3)
    expect(store.list().map((post) => post.id)).toEqual(['seed-1', 'seed-2', 'seed-3'])
  })

  it('seed 为 false 时为空库', () => {
    const store = emptyStore()
    expect(store.count()).toBe(0)
    expect(store.list()).toEqual([])
  })

  it('create 生成 id、时间与默认字段，hue 按条数轮转', () => {
    let index = 0
    const store = createPostStore({ seed: false, now: () => NOW, generateId: () => `id-${++index}` })
    const first = store.create({ content: '第一条' })
    expect(first.id).toBe('id-1')
    expect(first.createdAt).toBe(NOW)
    expect(first.likes).toBe(0)
    expect(first.liked).toBe(false)
    expect(first.hue).toBe(PALETTE[0])
    expect(store.count()).toBe(1)

    const second = store.create({ content: '第二条' })
    expect(second.id).toBe('id-2')
    expect(second.hue).toBe(PALETTE[1])
  })

  it('hue 七条一轮转', () => {
    const store = emptyStore()
    const hues = Array.from({ length: 8 }, (_unused, i) => store.create({ content: `第 ${i} 条` }).hue)
    expect(hues).toEqual([...PALETTE, PALETTE[0]])
  })

  it('create 会 trim 内容并按码点校验', () => {
    const store = emptyStore()
    expect(store.create({ content: '  带空格  ' }).content).toBe('带空格')

    expect(() => store.create({ content: '   ' })).toThrowError('内容不能为空')
    expect(() => store.create({ content: '字'.repeat(MAX_LENGTH + 1) })).toThrowError('最多 140 字')

    const emojis = store.create({ content: '😀'.repeat(MAX_LENGTH) })
    expect(Array.from(emojis.content)).toHaveLength(MAX_LENGTH)
  })

  it('校验失败抛出 VALIDATION_ERROR', () => {
    const store = emptyStore()
    try {
      store.create({ content: '' })
      throw new Error('未抛出异常')
    } catch (error) {
      expect(error).toBeInstanceOf(StoreError)
      expect((error as StoreError).code).toBe('VALIDATION_ERROR')
    }
  })

  it('list 的 hot 排序按 likes 倒序', () => {
    const store = createPostStore({ now: () => NOW })
    expect(store.list({ sort: 'hot' }).map((post) => post.id)).toEqual(['seed-3', 'seed-1', 'seed-2'])
  })

  it('hot 排序点赞并列时按时间倒序', () => {
    let clock = NOW
    const store = createPostStore({ seed: false, now: () => clock })
    const older = store.create({ content: '先发的' })
    clock = NOW + MINUTE
    const newer = store.create({ content: '后发的' })
    store.update(older.id, { liked: true })
    store.update(newer.id, { liked: true })
    expect(store.list({ sort: 'hot' }).map((post) => post.content)).toEqual(['后发的', '先发的'])
  })

  it('list 的 q 为大小写不敏感子串过滤，空串不过滤', () => {
    const store = emptyStore()
    store.create({ content: 'Reading Time' })
    store.create({ content: '看书' })
    expect(store.list({ q: 'READ' }).map((post) => post.content)).toEqual(['Reading Time'])
    expect(store.list({ q: '看书' })).toHaveLength(1)
    expect(store.list({ q: '' })).toHaveLength(2)
  })

  it('update 点赞与计数联动，重复设置幂等且不为负', () => {
    const store = emptyStore()
    const post = store.create({ content: '点赞测试' })

    const liked = store.update(post.id, { liked: true })
    expect(liked.liked).toBe(true)
    expect(liked.likes).toBe(1)
    expect(store.update(post.id, { liked: true }).likes).toBe(1)

    const unliked = store.update(post.id, { liked: false })
    expect(unliked.liked).toBe(false)
    expect(unliked.likes).toBe(0)
    expect(store.update(post.id, { liked: false }).likes).toBe(0)
  })

  it('update 内容不影响创建时间与配色', () => {
    let clock = NOW
    const store = createPostStore({ seed: false, now: () => clock })
    const post = store.create({ content: '旧内容' })
    clock = NOW + HOUR
    const updated = store.update(post.id, { content: '  新内容  ' })
    expect(updated.content).toBe('新内容')
    expect(updated.createdAt).toBe(NOW)
    expect(updated.hue).toBe(post.hue)
  })

  it('update 复用正文校验，未知 id 抛 NOT_FOUND', () => {
    const store = emptyStore()
    const post = store.create({ content: '原始' })
    expect(() => store.update(post.id, { content: '   ' })).toThrowError('内容不能为空')
    expect(() => store.update(post.id, { content: '字'.repeat(MAX_LENGTH + 1) })).toThrowError(
      '最多 140 字',
    )

    try {
      store.update('missing', { liked: true })
      throw new Error('未抛出异常')
    } catch (error) {
      expect(error).toBeInstanceOf(StoreError)
      expect((error as StoreError).code).toBe('NOT_FOUND')
    }
  })

  it('remove 返回布尔并真正移除', () => {
    const store = emptyStore()
    const post = store.create({ content: '将被删除' })
    expect(store.remove(post.id)).toBe(true)
    expect(store.count()).toBe(0)
    expect(store.get(post.id)).toBeUndefined()
    expect(store.remove(post.id)).toBe(false)
  })

  it('不同实例之间互不影响', () => {
    const a = emptyStore()
    const b = emptyStore()
    a.create({ content: 'A 的片语' })
    expect(a.count()).toBe(1)
    expect(b.count()).toBe(0)
  })
})
