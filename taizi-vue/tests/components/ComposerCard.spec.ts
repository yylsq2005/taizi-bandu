import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../src/api/client', () => {
  class MockApiError extends Error {
    readonly status = 400
    readonly code = 'VALIDATION_ERROR'
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

import ComposerCard from '../../src/components/ComposerCard.vue'
import { useFeedStore } from '../../src/stores/feed'
import { api } from '../../src/api/client'
import type { Post } from '../../src/types'

const mocked = vi.mocked(api, true)
const MAX = 140

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

/** 组件依赖 store，先让 store 拿到测试数据再挂载 */
async function mountComposer() {
  const pinia = createPinia()
  setActivePinia(pinia)
  mocked.listPosts.mockResolvedValue([fixture('a'), fixture('b'), fixture('c')])
  const store = useFeedStore()
  await store.init()
  const wrapper = mount(ComposerCard, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.listPosts.mockResolvedValue([])
})

describe('ComposerCard：字数统计', () => {
  it('初始显示「还可输入 140 字」且发布按钮禁用', async () => {
    const { wrapper } = await mountComposer()
    expect(wrapper.find('.counter__text').text()).toBe('还可输入 140 字')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.counter').attributes('data-state')).toBe('normal')
  })

  it('输入后计数实时更新并启用发布', async () => {
    const { wrapper } = await mountComposer()
    await wrapper.find('textarea').setValue('你好世界')
    expect(wrapper.find('.counter__text').text()).toBe(`还可输入 ${MAX - 4} 字`)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('剩余 20 字以内进入 warn 状态', async () => {
    const { wrapper } = await mountComposer()
    await wrapper.find('textarea').setValue('字'.repeat(MAX - 15))
    expect(wrapper.find('.counter').attributes('data-state')).toBe('warn')
  })

  it('超出上限显示「已超出 N 字」并禁用发布', async () => {
    const { wrapper } = await mountComposer()
    await wrapper.find('textarea').setValue('字'.repeat(MAX + 3))
    expect(wrapper.find('.counter__text').text()).toBe('已超出 3 字')
    expect(wrapper.find('.counter').attributes('data-state')).toBe('over')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('emoji 按 1 个字计数', async () => {
    const { wrapper } = await mountComposer()
    await wrapper.find('textarea').setValue('😀😀')
    expect(wrapper.find('.counter__text').text()).toBe(`还可输入 ${MAX - 2} 字`)
  })

  it('副标题说明数据存于服务端内存', async () => {
    const { wrapper } = await mountComposer()
    expect(wrapper.find('.composer__sub').text()).toContain('存于服务端内存')
  })
})

describe('ComposerCard：发布流程', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('提交后延迟发布：写入 store、清空输入框、发出 published 事件', async () => {
    const { wrapper, store } = await mountComposer()
    const created = fixture('srv-1', { content: '今天写了一条', createdAt: 999, hue: 158 })
    mocked.createPost.mockResolvedValue(created)
    const before = store.posts.length

    await wrapper.find('textarea').setValue('  今天写了一条  ')
    await wrapper.find('form').trigger('submit')

    // 延迟期间按钮处于加载态且禁用
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"] span').text()).toBe('发布中…')

    await vi.advanceTimersByTimeAsync(360)
    await wrapper.vm.$nextTick()

    expect(mocked.createPost).toHaveBeenCalledWith('今天写了一条')
    expect(store.posts.length).toBe(before + 1)
    expect(store.posts[0]).toEqual(created)
    expect(wrapper.find('textarea').element.value).toBe('')
    expect(wrapper.emitted('published')![0]).toEqual([{ ok: true }])
    expect(wrapper.find('button[type="submit"] span').text()).toBe('发布')
  })

  it('发布成功后回到「全部」并清空搜索', async () => {
    const { wrapper, store } = await mountComposer()
    mocked.createPost.mockResolvedValue(fixture('srv-2', { content: '发一条' }))

    store.setFilter('hot')
    store.setKeyword('某关键词')
    await wrapper.find('textarea').setValue('发一条')
    await wrapper.find('form').trigger('submit')
    await vi.advanceTimersByTimeAsync(360)
    await wrapper.vm.$nextTick()

    expect(store.filter).toBe('all')
    expect(store.keyword).toBe('')
  })

  it('服务端拒绝时保留草稿并上报错误文案', async () => {
    const { wrapper, store } = await mountComposer()
    mocked.createPost.mockRejectedValue(new Error('内容不能为空'))
    const before = store.posts.length

    await wrapper.find('textarea').setValue('这条会被拒绝')
    await wrapper.find('form').trigger('submit')
    await vi.advanceTimersByTimeAsync(360)
    await wrapper.vm.$nextTick()

    expect(store.posts.length).toBe(before)
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('这条会被拒绝')
    expect(wrapper.emitted('published')![0]).toEqual([{ ok: false, message: '内容不能为空' }])
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('button[type="submit"] span').text()).toBe('发布')
  })

  it('发布中重复提交被忽略', async () => {
    const { wrapper, store } = await mountComposer()
    mocked.createPost.mockImplementation(
      (content: string) => new Promise((resolve) => setTimeout(() => resolve(fixture('srv', { content })), 0)),
    )

    await wrapper.find('textarea').setValue('第一条')
    await wrapper.find('form').trigger('submit')
    await wrapper.find('textarea').setValue('第二条')
    await wrapper.find('form').trigger('submit')

    await vi.advanceTimersByTimeAsync(400)
    await wrapper.vm.$nextTick()

    expect(mocked.createPost).toHaveBeenCalledTimes(1)
    expect(store.posts.filter((p) => p.content === '第一条' || p.content === '第二条')).toHaveLength(1)
  })
})

describe('ComposerCard：快捷话题', () => {
  it('点击话题 chip 插入到输入框', async () => {
    const { wrapper } = await mountComposer()
    await wrapper.find('.chip-tag[data-tag="#读书笔记"]').trigger('click')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('#读书笔记 ')
    // #读书笔记 5 字 + 结尾空格 1 字
    expect(wrapper.find('.counter__text').text()).toBe(`还可输入 ${MAX - 6} 字`)
  })
})
