import { ref } from 'vue'

/** 模块级共享的轻提示状态：所有组件共用同一个 toast */
const message = ref('')
const visible = ref(false)
let hideTimer: number | undefined
let goneTimer: number | undefined

export function useToast() {
  function show(text: string): void {
    message.value = text
    visible.value = true
    window.clearTimeout(hideTimer)
    window.clearTimeout(goneTimer)
    hideTimer = window.setTimeout(() => {
      visible.value = false
      goneTimer = window.setTimeout(() => {
        message.value = ''
      }, 240)
    }, 2600)
  }

  return { message, visible, show }
}
