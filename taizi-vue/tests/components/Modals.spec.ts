import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailModal from '../../src/components/DetailModal.vue'
import ConfirmModal from '../../src/components/ConfirmModal.vue'
import { countChars } from '../../src/utils/format'
import type { Post } from '../../src/types'

const post: Post = {
  id: 'p1',
  content: '把《长安的荔枝》读完了。#读书笔记',
  createdAt: Date.parse('2026-01-05T12:00:00Z'),
  likes: 8,
  liked: false,
  favorites: 3,
  favorited: false,
  hue: 158,
}

describe('DetailModal：详情弹层', () => {
  function mountDetail() {
    return mount(DetailModal, { props: { post } })
  }

  it('渲染全文、字数、获赞、收藏、日期与话题标签', () => {
    const wrapper = mountDetail()
    expect(wrapper.find('.sheet__content').text()).toContain('把《长安的荔枝》读完了。')
    expect(wrapper.find('.sheet__content .tag').text()).toBe('#读书笔记')
    const stats = wrapper.findAll('.sheet__stats div')
    expect(stats).toHaveLength(4)
    expect(stats[0].find('b').text()).toBe(String(countChars(post.content))) // 按 Unicode 码点计数
    expect(stats[1].find('b').text()).toBe('8')
    expect(stats[2].find('b').text()).toBe('3')
    expect(stats[2].find('span').text()).toBe('收藏')
    expect(wrapper.find('.sheet').attributes('role')).toBe('dialog')
  })

  it('未赞时点赞按钮显示「点赞」，点击发出 like 事件', async () => {
    const wrapper = mountDetail()
    const likeBtn = wrapper.find('[data-detail-action="like"]')
    expect(likeBtn.text()).toContain('点赞 8')
    await likeBtn.trigger('click')
    expect(wrapper.emitted('like')).toHaveLength(1)
  })

  it('已赞时点赞按钮显示「已赞」', () => {
    const wrapper = mount(DetailModal, { props: { post: { ...post, liked: true, likes: 9 } } })
    expect(wrapper.find('[data-detail-action="like"]').text()).toContain('已赞 9')
  })

  it('收藏按钮显示数量，点击发出 favorite 事件', async () => {
    const wrapper = mountDetail()
    const favBtn = wrapper.find('[data-detail-action="favorite"]')
    expect(favBtn.text()).toContain('收藏 3')
    expect(favBtn.attributes('aria-pressed')).toBe('false')
    await favBtn.trigger('click')
    expect(wrapper.emitted('favorite')).toHaveLength(1)
  })

  it('已收藏时按钮显示「已收藏 4」且 aria-pressed=true', () => {
    const wrapper = mount(DetailModal, {
      props: { post: { ...post, favorited: true, favorites: 4 } },
    })
    const favBtn = wrapper.find('[data-detail-action="favorite"]')
    expect(favBtn.text()).toContain('已收藏 4')
    expect(favBtn.attributes('aria-pressed')).toBe('true')
  })

  it('复制与删除按钮发出对应事件', async () => {
    const wrapper = mountDetail()
    await wrapper.find('[data-detail-action="copy"]').trigger('click')
    await wrapper.find('[data-detail-action="delete"]').trigger('click')
    expect(wrapper.emitted('copy')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('关闭按钮与遮罩点击发出 close 事件', async () => {
    const wrapper = mountDetail()
    await wrapper.find('.sheet__close').trigger('click')
    await wrapper.find('.modal__backdrop').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})

describe('ConfirmModal：删除确认弹层', () => {
  function mountConfirm() {
    return mount(ConfirmModal)
  }

  it('渲染确认文案与 dialog 语义', () => {
    const wrapper = mountConfirm()
    expect(wrapper.find('.confirm__title').text()).toBe('删除这条片语？')
    expect(wrapper.find('.confirm').attributes('role')).toBe('dialog')
  })

  it('「删除」发出 confirm，「再想想」与遮罩发出 close', async () => {
    const wrapper = mountConfirm()
    await wrapper.find('.btn-danger').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    await wrapper.find('.btn-flat').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.find('.modal__backdrop').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
