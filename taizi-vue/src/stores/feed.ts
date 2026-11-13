import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Filter, Post, TopicEntry } from '../types'
import { extractTags } from '../utils/format'
import {
  DEFAULT_TOPICS,
  MAX_LENGTH,
  PALETTE,
  byNewest,
  generateId,
  loadFeed,
  saveFeed,
} from '../utils/storage'

/**
 * 片语广场的全局状态：数据、筛选、搜索全部收口在这里，
 * 组件只消费状态与动作，不直接触碰 localStorage。
 */
export const useFeedStore = defineStore('feed', () => {
  /* ---------------- 状态 ---------------- */
  const posts = ref<Post[]>([])
  const filter = ref<Filter>('all') // all | hot
  const keyword = ref('')

  /* ---------------- 派生 ---------------- */
  const visiblePosts = computed<Post[]>(() => {
    let list = posts.value.slice()

    if (keyword.value) {
      const key = keyword.value.toLowerCase()
      list = list.filter((post) => post.content.toLowerCase().includes(key))
    }

    if (filter.value === 'hot') {
      list.sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt)
    } else {
      list.sort(byNewest)
    }
    return list
  })

  const totalLikes = computed(() => posts.value.reduce((sum, post) => sum + post.likes, 0))

  /** 热议榜：统计 #话题 条数，不足 5 条时用默认话题补齐 */
  const topics = computed<TopicEntry[]>(() => {
    const counter = new Map<string, number>()
    posts.value.forEach((post) => {
      extractTags(post.content).forEach((tag) => {
        counter.set(tag, (counter.get(tag) || 0) + 1)
      })
    })

    const list: TopicEntry[] = Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }))

    const fallback = DEFAULT_TOPICS.filter((tag) => !counter.has(tag))
    while (list.length < 5 && fallback.length) {
      list.push({ tag: fallback.shift()!, count: 0 })
    }
    return list
  })

  const feedLabel = computed(() => {
    const count = visiblePosts.value.length
    if (keyword.value) return `找到 ${count} 条`
    if (filter.value === 'hot') return `热门 ${count} 条`
    return `${posts.value.length} 条片语`
  })

  /* ---------------- 动作 ---------------- */
  /** 首次进入页面时从 localStorage 载入 */
  function init(): void {
    posts.value = loadFeed()
  }

  /** 多标签页 storage 事件触发时重新载入 */
  function reload(): void {
    posts.value = loadFeed()
  }

  /** 发布片语：非法内容返回 null，成功返回 { saved } 指示是否成功持久化 */
  function publish(content: string): { saved: boolean } | null {
    const trimmed = content.trim()
    if (!trimmed || Array.from(trimmed).length > MAX_LENGTH) return null

    const post: Post = {
      id: generateId(),
      content: trimmed,
      createdAt: Date.now(),
      likes: 0,
      liked: false,
      hue: PALETTE[posts.value.length % PALETTE.length],
    }
    posts.value.unshift(post)
    return { saved: saveFeed(posts.value) }
  }

  function toggleLike(id: string): void {
    const post = posts.value.find((item) => item.id === id)
    if (!post) return
    post.liked = !post.liked
    post.likes = Math.max(0, post.likes + (post.liked ? 1 : -1))
    saveFeed(posts.value)
  }

  function removePost(id: string): void {
    posts.value = posts.value.filter((post) => post.id !== id)
    saveFeed(posts.value)
  }

  function setFilter(next: Filter): void {
    filter.value = next
  }

  function setKeyword(next: string): void {
    keyword.value = next.trim()
  }

  /** 发布成功后回到「全部」并清空搜索 */
  function resetView(): void {
    filter.value = 'all'
    keyword.value = ''
  }

  return {
    posts,
    filter,
    keyword,
    visiblePosts,
    totalLikes,
    topics,
    feedLabel,
    init,
    reload,
    publish,
    toggleLike,
    removePost,
    setFilter,
    setKeyword,
    resetView,
  }
})
