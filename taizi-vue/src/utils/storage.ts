import type { Post, StorageLike } from '../types'
import { MAX_LENGTH } from '../constants'

export { MAX_LENGTH }
export type { StorageLike }

export const STORAGE_KEY = 'taizi.feed.v2'

/** 默认话题：热议榜不足 5 条时补齐用 */
export const DEFAULT_TOPICS = ['#今日片语', '#读书笔记', '#通勤路上', '#深夜书桌', '#周末计划']

/** 每条片语从调色板里取一个色相，保证前后两条颜色不一样 */
export const PALETTE = [340, 268, 205, 158, 35, 12, 300]

/** 生成唯一 id，优先使用 crypto.randomUUID */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9)
}

export function byNewest(a: Post, b: Post): number {
  return b.createdAt - a.createdAt
}

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
      content: '把《长安的荔枝》读完了，合上书那一刻忽然很饿。\n原来最动人的永远是那些笨拙又认真的坚持。#读书笔记',
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

/** 对任意原始数据做字段校验与兜底，非法条目返回 null */
export function normalizePost(raw: unknown): Post | null {
  if (!raw || typeof raw !== 'object') return null

  const record = raw as Record<string, unknown>
  const content = typeof record.content === 'string' ? record.content : ''
  if (!content.trim()) return null

  const created = Number(record.createdAt)
  const likes = Number(record.likes)

  return {
    id: typeof record.id === 'string' && record.id ? record.id : generateId(),
    content: Array.from(content).slice(0, 1000).join(''),
    createdAt: Number.isFinite(created) && created > 0 ? created : Date.now(),
    likes: Number.isFinite(likes) && likes > 0 ? Math.floor(likes) : 0,
    liked: record.liked === true,
    hue: Number.isFinite(Number(record.hue))
      ? (((Math.round(Number(record.hue))) % 360) + 360) % 360
      : hueFor(record.id || content),
  }
}

function hueFor(seed: unknown): number {
  const text = String(seed)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % 360
}

/**
 * 从 localStorage 读取片语列表。
 * - 首次使用：写入 3 条示例数据
 * - 兼容旧版裸数组结构
 * - 解析失败降级为空列表；存储不可用时退回内存示例数据
 */
export function loadFeed(storage: StorageLike = window.localStorage): Post[] {
  let raw: string | null = null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[太子伴读] localStorage 不可用，本次以内存数据演示：', error)
    return createSeedPosts().sort(byNewest)
  }

  if (raw === null) {
    const seeded = createSeedPosts()
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, posts: seeded }))
    } catch (error) {
      console.warn('[太子伴读] 写入示例数据失败：', error)
    }
    return seeded.sort(byNewest)
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { posts?: unknown }).posts)
        ? (parsed as { posts: unknown[] }).posts
        : []
    return list.map(normalizePost).filter((p): p is Post => p !== null).sort(byNewest)
  } catch (error) {
    console.warn('[太子伴读] 本地数据解析失败，已降级为空列表：', error)
    return []
  }
}

/** 写入 localStorage，隐私模式或配额不足时返回 false */
export function saveFeed(posts: Post[], storage: StorageLike = window.localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, posts }))
    return true
  } catch (error) {
    console.warn('[太子伴读] 保存失败（隐私模式或存储已满）：', error)
    return false
  }
}
