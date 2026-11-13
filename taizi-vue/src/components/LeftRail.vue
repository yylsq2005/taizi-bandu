<script setup lang="ts">
import { useFeedStore } from '../stores/feed'
import type { Filter } from '../types'

defineEmits<{
  filter: [filter: Filter]
  write: []
}>()

const store = useFeedStore()
</script>

<template>
  <aside class="rail" aria-label="我的信息">
    <section class="card rail__me">
      <span class="avatar avatar--xl" style="--h: 268">伴</span>
      <p class="rail__name">太子伴读</p>
      <p class="rail__bio">写点此刻，留给以后</p>
      <div class="rail__stats">
        <div>
          <b>{{ store.posts.length }}</b><span>片语</span>
        </div>
        <div>
          <b>{{ store.totalLikes }}</b><span>被赞</span>
        </div>
      </div>
    </section>

    <nav class="rail__nav" aria-label="广场导航">
      <button type="button" class="navitem" :class="{ 'is-active': store.filter === 'all' }"
              data-filter="all" @click="$emit('filter', 'all')">
        <span class="navitem__icon" style="--h: 268">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9"
               stroke-linejoin="round" aria-hidden="true">
            <rect x="4" y="4" width="7" height="7" rx="2" />
            <rect x="13" y="4" width="7" height="7" rx="2" />
            <rect x="4" y="13" width="7" height="7" rx="2" />
            <rect x="13" y="13" width="7" height="7" rx="2" />
          </svg>
        </span>
        广场
      </button>
      <button type="button" class="navitem" :class="{ 'is-active': store.filter === 'hot' }"
              data-filter="hot" @click="$emit('filter', 'hot')">
        <span class="navitem__icon" style="--h: 20">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9"
               stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.7.7-3.2 1.7-4.6.4 1.4 1.2 2.2 2.1 2.6C11.4 7.6 12 5.2 12 3Z" />
          </svg>
        </span>
        热门
      </button>
      <button type="button" class="navitem" data-nav="write" @click="$emit('write')">
        <span class="navitem__icon" style="--h: 160">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
            <path d="M13.5 6.5 17.5 10.5" />
          </svg>
        </span>
        写一条
      </button>
    </nav>

    <p class="rail__tip">所有内容仅保存在这台设备的浏览器里。</p>
  </aside>
</template>
