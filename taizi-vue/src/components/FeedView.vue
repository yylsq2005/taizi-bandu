<script setup lang="ts">
import { computed } from 'vue'
import { useFeedStore } from '../stores/feed'
import PostCard from './PostCard.vue'

const emit = defineEmits<{
  view: [id: string]
  copy: [id: string]
  tag: [tag: string]
}>()

const store = useFeedStore()

const hasKeyword = computed(() => store.keyword !== '')
</script>

<template>
  <div class="feedbar">
    <div class="tabs" role="tablist" aria-label="信息流筛选">
      <button type="button" class="tab" :class="{ 'is-active': store.filter === 'all' }" data-filter="all"
              role="tab" :aria-selected="store.filter === 'all'" @click="store.setFilter('all')">
        全部
      </button>
      <button type="button" class="tab" :class="{ 'is-active': store.filter === 'hot' }" data-filter="hot"
              role="tab" :aria-selected="store.filter === 'hot'" @click="store.setFilter('hot')">
        热门
      </button>
    </div>
    <span class="feedbar__count" aria-live="polite">{{ store.feedLabel }}</span>
  </div>

  <section aria-label="片语时间线">
    <ul class="timeline" :hidden="store.visiblePosts.length === 0">
      <PostCard v-for="post in store.visiblePosts" :key="post.id" :post="post"
                @like="store.toggleLike(post.id)" @view="emit('view', post.id)"
                @copy="emit('copy', post.id)" @tag="emit('tag', $event)" />
    </ul>

    <div class="empty" :hidden="store.visiblePosts.length > 0">
      <svg class="empty__art" viewBox="0 0 190 140" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="e-card" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#FFF3F9" />
            <stop offset="1" stop-color="#F1F4FF" />
          </linearGradient>
          <linearGradient id="e-plane" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#FF4D9D" />
            <stop offset=".55" stop-color="#A855F7" />
            <stop offset="1" stop-color="#22D3EE" />
          </linearGradient>
          <linearGradient id="e-bar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#FFC7E2" />
            <stop offset="1" stop-color="#D8CBFF" />
          </linearGradient>
        </defs>
        <rect x="26" y="22" width="96" height="96" rx="20" fill="url(#e-card)" stroke="#F0E8FA" />
        <rect x="42" y="44" width="46" height="6" rx="3" fill="url(#e-bar)" />
        <rect x="42" y="60" width="62" height="6" rx="3" fill="#E6E4F6" />
        <rect x="42" y="76" width="38" height="6" rx="3" fill="#E6E4F6" />
        <circle cx="52" cy="100" r="6" fill="#FFE0EF" />
        <circle cx="68" cy="100" r="6" fill="#E4EAFE" />
        <path d="M150 26l24-10-11 26-4-11-9-5z" fill="url(#e-plane)" />
        <path d="M174 16l-16 15" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8" />
        <circle cx="128" cy="96" r="4" fill="#FFD9EA" />
        <circle cx="146" cy="112" r="2.6" fill="#DCE4FA" />
        <circle cx="120" cy="14" r="3" fill="#E9E1FF" />
        <path d="M96 118c10-4 18-10 22-18" stroke="#E6DEF6" stroke-width="2" stroke-linecap="round"
              stroke-dasharray="1 7" />
      </svg>
      <p class="empty__title">{{ hasKeyword ? '没有找到相关片语' : '这里还很安静' }}</p>
      <p class="empty__desc">
        {{ hasKeyword ? '换个关键词试试，或者清空搜索看看全部内容。' : '写下此刻的一点点，它就会落在五彩的广场上。' }}
      </p>
    </div>
  </section>
</template>
