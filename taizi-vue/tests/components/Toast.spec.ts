import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import Toast from '../../src/components/Toast.vue'
import { useToast } from '../../src/composables/toast'

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast：轻提示', () => {
  it('默认隐藏', () => {
    const wrapper = mount(Toast)
    expect(wrapper.attributes('hidden')).toBeDefined()
    expect(wrapper.text()).toBe('')
  })

  it('show 后显示消息，2.6 秒后自动隐藏', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Toast)
    const { show } = useToast()

    show('已发布，落在广场最上方啦')
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('hidden')).toBeUndefined()
    expect(wrapper.classes()).toContain('is-visible')
    expect(wrapper.text()).toBe('已发布，落在广场最上方啦')

    await vi.advanceTimersByTimeAsync(2600 + 240)
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('hidden')).toBeDefined()
    expect(wrapper.classes()).not.toContain('is-visible')
  })

  it('连续 show 会重置计时器，只显示最新消息', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Toast)
    const { show } = useToast()

    show('第一条')
    await vi.advanceTimersByTimeAsync(2000)
    show('第二条')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('第二条')

    await vi.advanceTimersByTimeAsync(2600 + 240)
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('hidden')).toBeDefined()
  })
})
