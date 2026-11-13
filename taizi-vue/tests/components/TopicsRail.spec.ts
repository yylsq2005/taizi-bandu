import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TopicsRail from '../../src/components/TopicsRail.vue'
import { useFeedStore } from '../../src/stores/feed'

function mountRail() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useFeedStore()
  store.init()
  return {
    wrapper: mount(TopicsRail, { global: { plugins: [pinia] } }),
    store,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('TopicsRail：热议榜', () => {
  it('渲染 5 个话题，首位是条数最多的话题', () => {
    const { wrapper } = mountRail()
    const items = wrapper.findAll('.topics .topic')
    expect(items).toHaveLength(5)
    // seed 里有 #今日片语、#读书笔记、#通勤路上 各一条，按 Map 插入序保持并列顺序
    expect(items[0].find('.topic__name').text()).toBe('#今日片语')
    expect(items[0].find('.topic__count').text()).toBe('1 条')
  })

  it('没有条目的话题显示「待开启」', () => {
    const { wrapper } = mountRail()
    const pending = wrapper.findAll('.topics .topic').filter((t) => t.find('.topic__count').text() === '待开启')
    expect(pending.length).toBe(2)
    expect(pending.every((t) => t.find('.topic__rank').exists())).toBe(true)
  })

  it('点击话题发出 search 事件并携带话题文本', async () => {
    const { wrapper } = mountRail()
    await wrapper.findAll('.topics .topic')[0].trigger('click')
    expect(wrapper.emitted('search')![0]).toEqual(['#今日片语'])
  })

  it('排名序号从 1 开始', () => {
    const { wrapper } = mountRail()
    const ranks = wrapper.findAll('.topic__rank').map((r) => r.text())
    expect(ranks).toEqual(['1', '2', '3', '4', '5'])
  })
})
