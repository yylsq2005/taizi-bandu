import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ComposerCard from '../../src/components/ComposerCard.vue'
import { useFeedStore } from '../../src/stores/feed'

const MAX = 140

function mountComposer() {
  return mount(ComposerCard, { global: { plugins: [setActivePinia(createPinia())] } })
}

describe('ComposerCard：字数统计', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始显示「还可输入 140 字」且发布按钮禁用', () => {
    const wrapper = mountComposer()
    expect(wrapper.find('.counter__text').text()).toBe('还可输入 140 字')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.counter').attributes('data-state')).toBe('normal')
  })

  it('输入后计数实时更新并启用发布', async () => {
    const wrapper = mountComposer()
    await wrapper.find('textarea').setValue('你好世界')
    expect(wrapper.find('.counter__text').text()).toBe(`还可输入 ${MAX - 4} 字`)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('剩余 20 字以内进入 warn 状态', async () => {
    const wrapper = mountComposer()
    await wrapper.find('textarea').setValue('字'.repeat(MAX - 15))
    expect(wrapper.find('.counter').attributes('data-state')).toBe('warn')
  })

  it('超出上限显示「已超出 N 字」并禁用发布', async () => {
    const wrapper = mountComposer()
    await wrapper.find('textarea').setValue('字'.repeat(MAX + 3))
    expect(wrapper.find('.counter__text').text()).toBe('已超出 3 字')
    expect(wrapper.find('.counter').attributes('data-state')).toBe('over')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('emoji 按 1 个字计数', async () => {
    const wrapper = mountComposer()
    await wrapper.find('textarea').setValue('😀😀')
    expect(wrapper.find('.counter__text').text()).toBe(`还可输入 ${MAX - 2} 字`)
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
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useFeedStore()
    store.init()
    const before = store.posts.length

    const wrapper = mount(ComposerCard, { global: { plugins: [pinia] } })
    await wrapper.find('textarea').setValue('  今天写了一条  ')
    await wrapper.find('form').trigger('submit')

    // 延迟期间按钮处于加载态且禁用
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"] span').text()).toBe('发布中…')

    await vi.advanceTimersByTimeAsync(360)
    await wrapper.vm.$nextTick()

    expect(store.posts.length).toBe(before + 1)
    expect(store.posts[0].content).toBe('今天写了一条')
    expect(wrapper.find('textarea').element.value).toBe('')
    expect(wrapper.emitted('published')![0]).toEqual([{ saved: true }])
    expect(wrapper.find('button[type="submit"] span').text()).toBe('发布')
  })

  it('发布中重复提交被忽略', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useFeedStore()
    store.init()

    const wrapper = mount(ComposerCard, { global: { plugins: [pinia] } })
    await wrapper.find('textarea').setValue('第一条')
    await wrapper.find('form').trigger('submit')
    await wrapper.find('textarea').setValue('第二条')
    await wrapper.find('form').trigger('submit')

    await vi.advanceTimersByTimeAsync(360)
    await wrapper.vm.$nextTick()

    expect(store.posts.filter((p) => p.content === '第一条' || p.content === '第二条')).toHaveLength(1)
  })
})

describe('ComposerCard：快捷话题', () => {
  it('点击话题 chip 插入到输入框', async () => {
    const wrapper = mountComposer()
    await wrapper.find('.chip-tag[data-tag="#读书笔记"]').trigger('click')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('#读书笔记 ')
    // #读书笔记 5 字 + 结尾空格 1 字
    expect(wrapper.find('.counter__text').text()).toBe(`还可输入 ${MAX - 6} 字`)
  })
})
