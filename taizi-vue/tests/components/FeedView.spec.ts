import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FeedView from '../../src/components/FeedView.vue'
import { useFeedStore } from '../../src/stores/feed'

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFeedStore()
  store.init()
  const wrapper = mount(FeedView, { global: { plugins: [pinia] } })
  return { wrapper, store }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('FeedView：时间线与空状态', () => {
  it('有片语时渲染卡片列表并隐藏空状态', () => {
    const { wrapper } = mountView()
    expect(wrapper.findAll('.timeline .post')).toHaveLength(3)
    expect(wrapper.find('.timeline').attributes('hidden')).toBeUndefined()
    expect(wrapper.find('.empty').attributes('hidden')).toBeDefined()
    expect(wrapper.find('.feedbar__count').text()).toBe('3 条片语')
  })

  it('无任何片语时显示安静空状态', async () => {
    const { wrapper, store } = mountView()
    store.posts.forEach((p) => store.removePost(p.id))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.empty__title').text()).toBe('这里还很安静')
    expect(wrapper.find('.empty__desc').text()).toContain('写下此刻的一点点')
  })

  it('搜索无结果时显示未找到空状态', async () => {
    const { wrapper, store } = mountView()
    store.setKeyword('不存在的词')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.empty__title').text()).toBe('没有找到相关片语')
    expect(wrapper.find('.empty__desc').text()).toContain('换个关键词')
    expect(wrapper.find('.feedbar__count').text()).toBe('找到 0 条')
  })
})

describe('FeedView：筛选与卡片事件', () => {
  it('点击「热门」tab 更新 store.filter', async () => {
    const { wrapper, store } = mountView()
    await wrapper.find('[data-filter="hot"]').trigger('click')
    expect(store.filter).toBe('hot')
    expect(wrapper.find('.feedbar__count').text()).toBe('热门 3 条')
  })

  it('热门排序：likes 多的在前', async () => {
    const { wrapper, store } = mountView()
    store.posts[1].likes = 99
    store.setFilter('hot')
    await wrapper.vm.$nextTick()
    const ids = wrapper.findAll('.timeline .post').map((c) => c.attributes('data-id'))
    expect(ids[0]).toBe(store.posts[1].id)
  })

  it('卡片事件向上转发：like/view/copy/tag', async () => {
    const { wrapper } = mountView()
    const firstCard = wrapper.findAll('.timeline .post')[0]
    await firstCard.find('[data-action="like"]').trigger('click')
    await firstCard.find('[data-action="view"]').trigger('click')
    await firstCard.find('[data-action="copy"]').trigger('click')
    await firstCard.find('.tag').trigger('click')

    expect(wrapper.emitted('view')).toHaveLength(1)
    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('tag')![0]).toEqual(['#今日片语'])
    // like 由 FeedView 直接调 store
    expect(wrapper.emitted('like')).toBeUndefined()
  })
})
