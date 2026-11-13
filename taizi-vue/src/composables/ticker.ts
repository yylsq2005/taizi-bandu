import { onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * 周期心跳：让相对时间等随时间变化的文案定期刷新。
 * 组件卸载时自动清理定时器。
 */
export function useTicker(intervalMs: number): Ref<number> {
  const tick = ref(0)
  const timer = window.setInterval(() => {
    tick.value++
  }, intervalMs)
  onBeforeUnmount(() => window.clearInterval(timer))
  return tick
}
