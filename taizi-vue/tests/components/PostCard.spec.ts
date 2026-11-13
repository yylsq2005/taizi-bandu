import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PostCard from '../../src/components/PostCard.vue'
import type { Post } from '../../src/types'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    content: '窗外的梧桐叶全黄了。#今日片语',
    createdAt: Date.now() - 5 * 60_000,
    likes: 12,
    liked: false,
    hue: 340,
    ...overrides,
  }
}

function mountCard(post: Post) {
  return mount(PostCard, { props: { post } })
}

describe('PostCard：内容渲染', () => {
  it('渲染正文与 #话题彩色标签', () => {
    const wrapper = mountCard(makePost())
    expect(wrapper.text()).toContain('窗外的梧桐叶全黄了。')
    const tag = wrapper.find('.tag')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('#今日片语')
  })

  it('HTML 字符按纯文本渲染（XSS 防护，不用 v-html）', () => {
    const wrapper = mountCard(makePost({ content: '<img src=x onerror=alert(1)>普通文字' }))
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('渲染相对时间与认证名', () => {
    const wrapper = mountCard(makePost())
    expect(wrapper.text()).toContain('5 分钟前')
    expect(wrapper.text()).toContain('太子伴读')
  })
})

describe('PostCard：操作栏', () => {
  it('未赞状态：badge 为「片语」，aria-pressed=false', () => {
    const wrapper = mountCard(makePost())
    expect(wrapper.find('.post__badge').text()).toBe('片语')
    const like = wrapper.find('[data-action="like"]')
    expect(like.attributes('aria-pressed')).toBe('false')
    expect(like.classes()).not.toContain('is-liked')
    expect(wrapper.find('[data-action="like"] span').text()).toBe('12')
  })

  it('已赞状态：badge 为「已赞」，aria-pressed=true，is-liked 类', () => {
    const wrapper = mountCard(makePost({ liked: true, likes: 13 }))
    expect(wrapper.find('.post__badge').text()).toBe('已赞')
    const like = wrapper.find('[data-action="like"]')
    expect(like.attributes('aria-pressed')).toBe('true')
    expect(like.classes()).toContain('is-liked')
  })

  it('点击点赞 / 查看 / 复制按钮发出对应事件', async () => {
    const wrapper = mountCard(makePost())
    await wrapper.find('[data-action="like"]').trigger('click')
    await wrapper.find('[data-action="view"]').trigger('click')
    await wrapper.find('[data-action="copy"]').trigger('click')
    expect(wrapper.emitted('like')).toHaveLength(1)
    expect(wrapper.emitted('view')).toHaveLength(1)
    expect(wrapper.emitted('copy')).toHaveLength(1)
  })

  it('点击正文里的 #话题 发出 tag 事件并携带话题文本', async () => {
    const wrapper = mountCard(makePost())
    await wrapper.find('.tag').trigger('click')
    expect(wrapper.emitted('tag')![0]).toEqual(['#今日片语'])
  })
})
