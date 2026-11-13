<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useFeedStore } from '../stores/feed'
import { countChars } from '../utils/format'
import { MAX_LENGTH, PUBLISH_DELAY } from '../constants'

const emit = defineEmits<{
  published: [result: { ok: boolean; message?: string }]
}>()

const store = useFeedStore()

const draft = ref('')
const submitting = ref(false)
const inputEl = ref<HTMLTextAreaElement | null>(null)

const QUICK_TAGS = ['#今日片语', '#读书笔记', '#通勤路上', '#深夜书桌']

/* 字数与状态全部派生，不保留冗余状态 */
const length = computed(() => countChars(draft.value))
const remaining = computed(() => MAX_LENGTH - length.value)
const counterState = computed(() =>
  remaining.value < 0 ? 'over' : remaining.value <= 20 ? 'warn' : 'normal',
)
const counterText = computed(() =>
  remaining.value < 0 ? `已超出 ${Math.abs(remaining.value)} 字` : `还可输入 ${remaining.value} 字`,
)
const fillWidth = computed(() => `${Math.min((length.value / MAX_LENGTH) * 100, 100)}%`)
const canPublish = computed(() => !submitting.value && remaining.value >= 0 && draft.value.trim() !== '')

async function insertTag(tag: string): Promise<void> {
  const el = inputEl.value
  const start = el ? (el.selectionStart ?? draft.value.length) : draft.value.length
  const needsSpace = draft.value !== '' && !/\s$/.test(draft.value)
  draft.value =
    draft.value.slice(0, start) + (needsSpace ? ' ' : '') + tag + ' ' + draft.value.slice(start)
  await nextTick()
  if (el) {
    el.focus()
    el.selectionStart = el.selectionEnd = draft.value.length
  }
}

function handleSubmit(): void {
  if (submitting.value) return

  const content = draft.value.trim()
  if (!content || countChars(content) > MAX_LENGTH) return

  submitting.value = true
  window.setTimeout(() => {
    void (async () => {
      const result = await store.publish(content)
      if (result.ok) {
        store.resetView()
        draft.value = ''
        inputEl.value?.focus({ preventScroll: true })
        emit('published', { ok: true })
      } else {
        // 服务端拒绝时保留草稿，用户可以直接改了再发
        emit('published', { ok: false, message: result.message })
      }
      submitting.value = false
    })()
  }, PUBLISH_DELAY)
}

function focusInput(): void {
  inputEl.value?.focus()
}

defineExpose({ focusInput })
</script>

<template>
  <section ref="composerCard" class="card composer" aria-label="发布新的片语">
    <div class="composer__head">
      <span class="avatar avatar--lg" style="--h: 268" aria-hidden="true">伴</span>
      <div>
        <p class="composer__title">此刻，想写下什么？</p>
        <p class="composer__sub">140 字以内 · 存于服务端内存</p>
      </div>
    </div>

    <form novalidate @submit.prevent="handleSubmit">
      <label class="visually-hidden" for="composer-input">写下此刻的想法</label>
      <textarea id="composer-input" ref="inputEl" v-model="draft" class="composer__input" name="content"
                rows="3" placeholder="记录一件小事、一句感叹，或一个突然冒出来的念头…"
                aria-describedby="char-counter" :readonly="submitting"></textarea>

      <div class="chips" aria-label="快捷话题">
        <button v-for="tag in QUICK_TAGS" :key="tag" type="button" class="chip-tag" :data-tag="tag"
                @click="insertTag(tag)">
          {{ tag }}
        </button>
      </div>

      <div class="composer__foot">
        <div class="counter" :data-state="counterState">
          <div class="counter__bar" aria-hidden="true">
            <i class="counter__fill" :style="{ width: fillWidth }"></i>
          </div>
          <span id="char-counter" class="counter__text" aria-live="polite">{{ counterText }}</span>
        </div>

        <span class="publish-slot">
          <button type="submit" class="btn3d btn3d--hero" :disabled="!canPublish"
                  :aria-busy="submitting" :class="{ 'is-loading': submitting }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linejoin="round" aria-hidden="true">
              <path d="M21 3 10.5 13.5" />
              <path d="M21 3l-6.6 18-3.9-7.5L3 9.6 21 3Z" fill="currentColor" fill-opacity=".18" />
            </svg>
            <span>{{ submitting ? '发布中…' : '发布' }}</span>
          </button>
        </span>
      </div>
    </form>
  </section>
</template>
