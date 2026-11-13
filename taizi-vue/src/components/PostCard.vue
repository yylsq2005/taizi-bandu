<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '../types'
import { formatRelativeTime, splitContent } from '../utils/format'
import { useTicker } from '../composables/ticker'

const props = defineProps<{ post: Post }>()

defineEmits<{
  like: []
  favorite: []
  view: []
  copy: []
  tag: [tag: string]
}>()

/* 每 30 秒跳一次心跳，刷新相对时间文案 */
const tick = useTicker(30_000)
const relativeTime = computed(() => {
  void tick.value
  return formatRelativeTime(props.post.createdAt)
})

/* 话题高亮渲染：纯模板插值，不使用 v-html */
const parts = computed(() => splitContent(props.post.content))
</script>

<template>
  <li class="post card" :data-id="post.id" :style="{ '--h': String(post.hue) }">
    <span class="avatar avatar--md" :style="{ '--h': String(post.hue) }" aria-hidden="true">伴</span>

    <div class="post__main">
      <div class="post__head">
        <div class="post__who">
          <span class="post__name">
            太子伴读
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path
                d="M12 2.6l2.3 1.7 2.8-.2 1 2.7 2.3 1.7-1 2.7 1 2.7-2.3 1.7-1 2.7-2.8-.2L12 21.4l-2.3-1.7-2.8.2-1-2.7L3.6 15.5l1-2.7-1-2.7L5.9 8.4l1-2.7 2.8.2L12 2.6Zm-.2 12.6l4.3-4.4-1.4-1.4-2.9 3-1.4-1.4-1.4 1.4 2.8 2.8Z" />
            </svg>
          </span>
          <span class="post__meta">
            <time :datetime="new Date(post.createdAt).toISOString()">{{ relativeTime }}</time>
            · 来自广场
          </span>
        </div>
        <span class="post__badge" :class="{ 'post__badge--fav': post.favorited }">
          {{ post.favorited ? '已藏' : post.liked ? '已赞' : '片语' }}
        </span>
      </div>

      <p class="post__body">
        <template v-for="(part, index) in parts" :key="index">
          <span v-if="part.tag" class="tag" @click="$emit('tag', part.text)">{{ part.text }}</span>
          <template v-else>{{ part.text }}</template>
        </template>
      </p>

      <div class="post__actions">
        <button type="button" class="like-btn" :class="{ 'is-liked': post.liked }" data-action="like"
                :aria-pressed="post.liked" :aria-label="post.liked ? '取消点赞' : '点赞'"
                @click="$emit('like')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-9.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7 3.2C19 15.6 12 20 12 20Z" />
          </svg>
          <span>{{ post.likes }}</span>
        </button>

        <button type="button" class="fav-btn" :class="{ 'is-faved': post.favorited }"
                data-action="favorite" :aria-pressed="post.favorited"
                :aria-label="post.favorited ? '取消收藏' : '收藏'" @click="$emit('favorite')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3.6l2.5 5.3 5.7.8-4.1 4 1 5.7-5.1-2.8-5.1 2.8 1-5.7-4.1-4 5.7-.8L12 3.6Z" />
          </svg>
          <span>{{ post.favorites }}</span>
        </button>

        <button type="button" class="ghost-btn" data-action="copy" @click="$emit('copy')">复制</button>

        <button type="button" class="btn3d btn3d--mini" data-action="view" aria-label="查看这条片语的详情"
                @click="$emit('view')">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" />
            <circle cx="12" cy="12" r="2.7" />
          </svg>
          <span>查看</span>
        </button>
      </div>
    </div>
  </li>
</template>
