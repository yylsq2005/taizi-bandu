<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '../types'
import { countChars, formatDate, formatRelativeTime, hueOf, splitContent } from '../utils/format'

const props = defineProps<{ post: Post | null }>()

defineEmits<{
  close: []
  like: []
  copy: []
  delete: []
}>()

const hue = computed(() => (props.post ? hueOf(props.post) : 268))
const parts = computed(() => (props.post ? splitContent(props.post.content) : []))
const meta = computed(() => (props.post ? `${formatRelativeTime(props.post.createdAt)} · 来自本机` : ''))
const likeLabel = computed(() => {
  if (!props.post) return '点赞'
  return props.post.liked ? `已赞 ${props.post.likes}` : `点赞 ${props.post.likes || ''}`.trim()
})
</script>

<template>
  <div class="modal" :hidden="!post">
    <div class="modal__backdrop" @click="$emit('close')"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="detail-name">
      <div class="sheet__banner" :style="{ '--h': String(hue) }"></div>
      <button type="button" class="sheet__close" aria-label="关闭详情" @click="$emit('close')">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div v-if="post" class="sheet__body">
        <div class="sheet__head">
          <span class="avatar avatar--lg" :style="{ '--h': String(hue) }" aria-hidden="true">伴</span>
          <div class="sheet__who">
            <p id="detail-name" class="sheet__name">太子伴读</p>
            <p class="sheet__meta">{{ meta }}</p>
          </div>
        </div>

        <p class="sheet__content">
          <template v-for="(part, index) in parts" :key="index">
            <span v-if="part.tag" class="tag">{{ part.text }}</span>
            <template v-else>{{ part.text }}</template>
          </template>
        </p>

        <div class="sheet__stats">
          <div>
            <b>{{ countChars(post.content) }}</b><span>字数</span>
          </div>
          <div>
            <b>{{ post.likes }}</b><span>获赞</span>
          </div>
          <div>
            <b>{{ formatDate(post.createdAt) }}</b><span>发布</span>
          </div>
        </div>

        <div class="sheet__actions">
          <button type="button" class="btn3d btn3d--sm" data-detail-action="like"
                  :style="{ '--h': post.liked ? '340' : '268' }" :aria-pressed="post.liked"
                  @click="$emit('like')">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20s-7-4.4-7-9.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7 3.2C19 15.6 12 20 12 20Z" />
            </svg>
            <span>{{ likeLabel }}</span>
          </button>

          <button type="button" class="btn3d btn3d--sm btn3d--ghost" data-detail-action="copy"
                  style="--h: 225" @click="$emit('copy')">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9"
                 stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="10.5" height="10.5" rx="2.6" />
              <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-6A2.5 2.5 0 0 0 4 5.5v6A2.5 2.5 0 0 0 6.5 14" />
            </svg>
            复制全文
          </button>

          <button type="button" class="btn-ghost-danger" data-detail-action="delete" @click="$emit('delete')">
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
