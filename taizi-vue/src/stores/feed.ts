import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Filter, Post, TopicEntry } from '../types'
import { extractTags } from '../utils/format'
import { DEFAULT_TOPICS, MAX_LENGTH } from '../constants'
import { api } from '../api/client'

/** 时间倒序：最新的排在最前 */
function byNewest(a: Post, b: Post): number {
  return b.createdAt - a.createdAt
}

/** 把任意异常转成可直接展示的中文文案（不依赖 instanceof，便于测试替换 client） */
function errorText(error: unknown): string {
  const message = (error as { message?: unknown } | null | undefined)?.message
  return typeof message === 'string' && message ? message : '请求失败，请稍后再试'
}

export type PublishResult = { ok: true; post: Post } | { ok: false; message: string }

/**
 * 片语广场的全局状态：列表由服务端内存存储提供，
 * 筛选/搜索仍是本地派生，组件只消费状态与动作。
 */
export const useFeedStore = defineStore('feed', () => {
  /* ---------------- 状态 ---------------- */
  const posts = ref<Post[]>([])
  const filter = ref<Filter>('all') // all | hot
  const keyword = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

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
        counter.set(tag, (counter.get(tag) ?? 0) + 1)
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
  /** 拉取列表：失败时保留原有数据，只记录错误 */
  async function load(): Promise<void> {
    loading.value = true
    try {
      const list = await api.listPosts()
      posts.value = list.slice().sort(byNewest)
      error.value = null
    } catch (err) {
      error.value = errorText(err)
    } finally {
      loading.value = false
    }
  }

  /** 首次进入页面时载入 */
  const init = load

  /** 窗口重新可见时刷新，等同于多端数据同步 */
  const reload = load

  /** 发布片语：本地先校验，再交给服务端 */
  async function publish(content: string): Promise<PublishResult> {
    const trimmed = content.trim()
    if (!trimmed) return { ok: false, message: '内容不能为空' }
    if (Array.from(trimmed).length > MAX_LENGTH) return { ok: false, message: `最多 ${MAX_LENGTH} 字` }

    try {
      const created = await api.createPost(trimmed)
      const index = posts.value.findIndex((item) => item.id === created.id)
      if (index >= 0) posts.value.splice(index, 1, created)
      else posts.value.unshift(created)
      error.value = null
      return { ok: true, post: created }
    } catch (err) {
      const message = errorText(err)
      error.value = message
      return { ok: false, message }
    }
  }

  /** 点赞：先乐观更新，再用服务端结果校正，失败回滚 */
  async function toggleLike(id: string): Promise<void> {
    const post = posts.value.find((item) => item.id === id)
    if (!post) return

    const before = { liked: post.liked, likes: post.likes }
    const next = !before.liked
    post.liked = next
    post.likes = Math.max(0, before.likes + (next ? 1 : -1))

    try {
      const updated = await api.updatePost(id, { liked: next })
      const index = posts.value.findIndex((item) => item.id === id)
      if (index >= 0) posts.value.splice(index, 1, updated)
      error.value = null
    } catch (err) {
      const index = posts.value.findIndex((item) => item.id === id)
      if (index >= 0) posts.value.splice(index, 1, { ...posts.value[index], ...before })
      error.value = errorText(err)
    }
  }

  /** 删除：服务端确认成功后才从列表移除 */
  async function removePost(id: string): Promise<boolean> {
    if (!posts.value.some((item) => item.id === id)) return true

    try {
      await api.deletePost(id)
      posts.value = posts.value.filter((item) => item.id !== id)
      error.value = null
      return true
    } catch (err) {
      error.value = errorText(err)
      return false
    }
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

  function dismissError(): void {
    error.value = null
  }

  return {
    posts,
    filter,
    keyword,
    loading,
    error,
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
    dismissError,
  }
})
