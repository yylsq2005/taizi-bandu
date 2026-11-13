import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../src/api/client', () => ({
  ApiError: class MockApiError extends Error {},
  api: {
    health: vi.fn(),
    listPosts: vi.fn(),
    getPost: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
  },
}))

import TopicsRail from '../../src/components/TopicsRail.vue'
import { useFeedStore } from '../../src/stores/feed'
import { api } from '../../src/api/client'
import type { Post } from '../../src/types'

const mocked = vi.mocked(api, true)

const SEEDS: Post[] = [
  {
    id: 'seed-1',
    content: '清晨六点半的操场 #今日片语',
    createdAt: 300,
    likes: 12,
    liked: false,
    hue: 340,
  },
  {
    id: 'seed-2',
    content: '读完一本书 #读书笔记',
    createdAt: 200,
    likes: 8,
    liked: false,
    hue: 158,
  },
  {
    id: 'seed-3',
    content: '地铁见闻 #通勤路上',
    createdAt: 100,
    likes: 21,
    liked: false,
    hue: 205,
  },
]

async function mountRail() {
  const pinia = createPinia()
  setActivePinia(pinia)
  mocked.listPosts.mockResolvedValue(SEEDS)
  const store = useFeedStore()
  await store.init()
  return {
    wrapper: mount(TopicsRail, { global: { plugins: [pinia] } }),
    store,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.listPosts.mockResolvedValue(SEEDS)
})

describe('TopicsRail：热议榜', () => {
  it('渲染 5 个话题，首位是条数最多的话题', async () => {
    const { wrapper } = await mountRail()
    const items = wrapper.findAll('.topics .topic')
    expect(items).toHaveLength(5)
    // 三条 seed 各带一个话题，按 Map 插入序保持并列顺序
    expect(items[0].find('.topic__name').text()).toBe('#今日片语')
    expect(items[0].find('.topic__count').text()).toBe('1 条')
  })

  it('没有条目的话题显示「待开启」', async () => {
    const { wrapper } = await mountRail()
    const pending = wrapper
      .findAll('.topics .topic')
      .filter((t) => t.find('.topic__count').text() === '待开启')
    expect(pending.length).toBe(2)
    expect(pending.every((t) => t.find('.topic__rank').exists())).toBe(true)
  })

  it('点击话题发出 search 事件并携带话题文本', async () => {
    const { wrapper } = await mountRail()
    await wrapper.findAll('.topics .topic')[0].trigger('click')
    expect(wrapper.emitted('search')![0]).toEqual(['#今日片语'])
  })

  it('排名序号从 1 开始', async () => {
    const { wrapper } = await mountRail()
    const ranks = wrapper.findAll('.topic__rank').map((r) => r.text())
    expect(ranks).toEqual(['1', '2', '3', '4', '5'])
  })

  it('玩法提示说明数据存在服务端内存', async () => {
    const { wrapper } = await mountRail()
    expect(wrapper.find('.side__note').text()).toContain('服务端内存')
  })
})
