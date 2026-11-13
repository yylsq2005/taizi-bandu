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
    likePost: vi.fn(),
    favoritePost: vi.fn(),
    deletePost: vi.fn(),
  },
}))

import FeedView from '../../src/components/FeedView.vue'
import { useFeedStore } from '../../src/stores/feed'
import { api } from '../../src/api/client'
import type { Post } from '../../src/types'

const mocked = vi.mocked(api, true)

function fixture(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    content: `内容 ${id}`,
    createdAt: 100,
    likes: 0,
    liked: false,
    favorites: 0,
    favorited: false,
    hue: 340,
    ...overrides,
  }
}

const SEEDS: Post[] = [
  fixture('newest', { createdAt: 300, likes: 12, content: '梧桐叶黄了 #今日片语' }),
  fixture('middle', {
    createdAt: 200,
    likes: 8,
    content: '读完一本书 #读书笔记',
    favorited: true,
    favorites: 4,
  }),
  fixture('oldest', { createdAt: 100, likes: 21, content: '地铁见闻 #通勤路上' }),
]

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  mocked.listPosts.mockResolvedValue(SEEDS)
  const store = useFeedStore()
  await store.init()
  const wrapper = mount(FeedView, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.listPosts.mockResolvedValue(SEEDS)
})

describe('FeedView：时间线与空状态', () => {
  it('有片语时渲染卡片列表并隐藏空状态', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.findAll('.timeline .post')).toHaveLength(3)
    expect(wrapper.find('.timeline').attributes('hidden')).toBeUndefined()
    expect(wrapper.find('.empty').attributes('hidden')).toBeDefined()
    expect(wrapper.find('.feedbar__count').text()).toBe('3 条片语')
  })

  it('无任何片语时显示安静空状态', async () => {
    const { wrapper, store } = await mountView()
    store.posts = []
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.empty__title').text()).toBe('这里还很安静')
    expect(wrapper.find('.empty__desc').text()).toContain('写下此刻的一点点')
  })

  it('搜索无结果时显示未找到空状态', async () => {
    const { wrapper, store } = await mountView()
    store.setKeyword('不存在的词')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.empty__title').text()).toBe('没有找到相关片语')
    expect(wrapper.find('.empty__desc').text()).toContain('换个关键词')
    expect(wrapper.find('.feedbar__count').text()).toBe('找到 0 条')
  })
})

describe('FeedView：筛选与卡片事件', () => {
  it('点击「热门」tab 更新 store.filter', async () => {
    const { wrapper, store } = await mountView()
    await wrapper.find('[data-filter="hot"]').trigger('click')
    expect(store.filter).toBe('hot')
    expect(wrapper.find('.feedbar__count').text()).toBe('热门 3 条')
  })

  it('热门排序：likes 多的在前', async () => {
    const { wrapper, store } = await mountView()
    store.posts[1].likes = 99
    store.setFilter('hot')
    await wrapper.vm.$nextTick()
    const ids = wrapper.findAll('.timeline .post').map((c) => c.attributes('data-id'))
    expect(ids[0]).toBe(store.posts[1].id)
  })

  it('点击「收藏」tab 只显示已收藏，文案为「收藏 N 条」', async () => {
    const { wrapper, store } = await mountView()
    const favTab = wrapper.find('[data-filter="favorites"]')
    await favTab.trigger('click')
    expect(store.filter).toBe('favorites')
    expect(favTab.classes()).toContain('is-active')
    const ids = wrapper.findAll('.timeline .post').map((c) => c.attributes('data-id'))
    expect(ids).toEqual(['middle'])
    expect(wrapper.find('.feedbar__count').text()).toBe('收藏 1 条')
  })

  it('卡片收藏事件直接委派给 store.toggleFavorite', async () => {
    const { wrapper, store } = await mountView()
    const favoriteSpy = vi.spyOn(store, 'toggleFavorite').mockResolvedValue(undefined)
    const firstCard = wrapper.findAll('.timeline .post')[0]
    const id = firstCard.attributes('data-id')!

    await firstCard.find('[data-action="favorite"]').trigger('click')

    expect(favoriteSpy).toHaveBeenCalledWith(id)
    expect(wrapper.emitted('favorite')).toBeUndefined()
  })

  it('卡片事件向上转发：like/view/copy/tag', async () => {
    const { wrapper, store } = await mountView()
    const likeSpy = vi.spyOn(store, 'toggleLike').mockResolvedValue(undefined)
    const firstCard = wrapper.findAll('.timeline .post')[0]
    const id = firstCard.attributes('data-id')!

    await firstCard.find('[data-action="like"]').trigger('click')
    await firstCard.find('[data-action="view"]').trigger('click')
    await firstCard.find('[data-action="copy"]').trigger('click')
    await firstCard.find('.tag').trigger('click')

    expect(likeSpy).toHaveBeenCalledWith(id)
    expect(wrapper.emitted('view')).toHaveLength(1)
    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('tag')![0]).toEqual(['#今日片语'])
    // like 由 FeedView 直接调 store，不向上冒泡
    expect(wrapper.emitted('like')).toBeUndefined()
  })
})
