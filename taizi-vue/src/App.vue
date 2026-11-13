<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useFeedStore } from './stores/feed'
import { copyText } from './utils/clipboard'
import { useToast } from './composables/toast'
import type { Filter } from './types'
import LeftRail from './components/LeftRail.vue'
import ComposerCard from './components/ComposerCard.vue'
import FeedView from './components/FeedView.vue'
import TopicsRail from './components/TopicsRail.vue'
import DetailModal from './components/DetailModal.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import Toast from './components/Toast.vue'

const store = useFeedStore()
const { show } = useToast()

const viewingId = ref<string | null>(null)
const pendingDeleteId = ref<string | null>(null)
const searchText = ref('')
const searchEl = ref<HTMLInputElement | null>(null)
const composerEl = ref<InstanceType<typeof ComposerCard> | null>(null)

const detailPost = computed(() => store.posts.find((post) => post.id === viewingId.value) ?? null)

/* 搜索框内容与 store 关键字双向同步（store 只保存 trim 后的关键字） */
watch(
  () => store.keyword,
  (next) => {
    if (next !== searchText.value.trim()) searchText.value = next
  },
)

watch([viewingId, pendingDeleteId], ([detail, confirm]) => {
  document.body.classList.toggle('is-locked', Boolean(detail || confirm))
})

/* 任何一步操作失败都把原因播报出来，然后清空，避免重复提示 */
watch(
  () => store.error,
  (message) => {
    if (!message) return
    show(message)
    store.dismissError()
  },
)

function handleSearchInput(event: Event): void {
  searchText.value = (event.target as HTMLInputElement).value
  store.setKeyword(searchText.value)
}

function searchTopic(tag: string): void {
  searchText.value = tag
  store.setKeyword(tag)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function setFilterAndTop(filter: Filter): void {
  store.setFilter(filter)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function scrollToComposer(): void {
  const root = composerEl.value?.$el as HTMLElement | undefined
  root?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(() => composerEl.value?.focusInput(), 260)
}

function handlePublished(result: { ok: boolean; message?: string }): void {
  if (result.ok) {
    show('已发布，落在广场最上方啦')
    return
  }
  show(result.message ?? '发布失败，请稍后再试')
}

function handleCopy(id: string): void {
  const post = store.posts.find((item) => item.id === id)
  if (!post) return
  copyText(post.content)
    .then(() => show('正文已复制到剪贴板'))
    .catch(() => show('复制失败，请手动选中文字'))
}

async function handleConfirmDelete(): Promise<void> {
  const id = pendingDeleteId.value
  pendingDeleteId.value = null
  if (!id) return

  const removed = await store.removePost(id)
  if (!removed) return // 失败原因由 store.error 统一提示
  if (viewingId.value === id) viewingId.value = null
  show('已从服务端删除')
}

function toggleViewingLike(): void {
  if (viewingId.value) void store.toggleLike(viewingId.value)
}

function toggleViewingFavorite(): void {
  if (viewingId.value) void store.toggleFavorite(viewingId.value)
}

function copyViewing(): void {
  if (viewingId.value) handleCopy(viewingId.value)
}

function requestDeleteViewing(): void {
  if (viewingId.value) pendingDeleteId.value = viewingId.value
}

function scrollTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (pendingDeleteId.value) {
    pendingDeleteId.value = null
    return
  }
  if (viewingId.value) viewingId.value = null
}

/** 窗口重新可见时拉一次最新数据，效果等同之前的跨标签页同步 */
function handleVisibility(): void {
  if (document.visibilityState === 'visible') void store.reload()
}

onMounted(() => {
  void store.init()
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('visibilitychange', handleVisibility)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('visibilitychange', handleVisibility)
  document.body.classList.remove('is-locked')
})
</script>

<template>
  <div class="aurora" aria-hidden="true">
    <span class="aurora__blob aurora__blob--1"></span>
    <span class="aurora__blob aurora__blob--2"></span>
    <span class="aurora__blob aurora__blob--3"></span>
    <span class="aurora__blob aurora__blob--4"></span>
  </div>

  <header class="topbar">
    <div class="topbar__inner">
      <div class="brand">
        <span class="brand__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path
              d="M18.8 4.4c-4.2.4-7.9 2.2-9.9 4.7-1.3 1.7-2 3.8-2.2 5.7-.1.7.5 1.2 1.2 1 1.9-.4 4-1.2 5.5-2.5 2.3-1.9 4.3-5.2 5.4-8.9Z"
              fill="currentColor" opacity=".96" />
            <path d="M4.8 20.2c1.2-3.7 3.2-6.4 6-8.4" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" />
          </svg>
        </span>
        <span class="brand__name">太子伴读</span>
        <span class="brand__badge">PLAZA</span>
      </div>

      <label class="search">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.4" />
          <path d="M16 16l4 4" />
        </svg>
        <input id="search-input" ref="searchEl" type="search" placeholder="搜索片语或话题…"
               autocomplete="off" aria-label="搜索片语或话题" :value="searchText"
               @input="handleSearchInput" />
      </label>

      <div class="topbar__actions">
        <span class="chip">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.6" />
            <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
          </svg>
          内存存储
        </span>
        <button type="button" class="btn3d btn3d--sm" style="--h: 268" @click="scrollToComposer">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
            <path d="M13.5 6.5 17.5 10.5" />
          </svg>
          写一条
        </button>
      </div>
    </div>
  </header>

  <div class="shell">
    <LeftRail @filter="setFilterAndTop" @write="scrollToComposer" />

    <main class="feed">
      <ComposerCard ref="composerEl" @published="handlePublished" />
      <FeedView @view="viewingId = $event" @copy="handleCopy" @tag="searchTopic" />

      <footer class="page-footer">
        <p>内容存于服务端内存 · 太子伴读</p>
      </footer>
    </main>

    <TopicsRail @search="searchTopic" />
  </div>

  <nav class="tabbar" aria-label="底部导航">
    <button type="button" class="tabbar__item" :class="{ 'is-active': store.filter === 'all' }"
            data-nav="all" @click="setFilterAndTop('all')">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"
           stroke-linejoin="round" aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
      广场
    </button>
    <button type="button" class="tabbar__item" :class="{ 'is-active': store.filter === 'hot' }"
            data-nav="hot" @click="setFilterAndTop('hot')">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"
           stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.7.7-3.2 1.7-4.6.4 1.4 1.2 2.2 2.1 2.6C11.4 7.6 12 5.2 12 3Z" />
      </svg>
      热门
    </button>
    <button type="button" class="tabbar__fab" aria-label="发布新的片语" @click="scrollToComposer">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4"
           stroke-linecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
    <button type="button" class="tabbar__item" :class="{ 'is-active': store.filter === 'favorites' }"
            data-nav="favorites" @click="setFilterAndTop('favorites')">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"
           stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3.6l2.5 5.3 5.7.8-4.1 4 1 5.7-5.1-2.8-5.1 2.8 1-5.7-4.1-4 5.7-.8L12 3.6Z" />
      </svg>
      收藏
    </button>
    <button type="button" class="tabbar__item" data-nav="top" @click="scrollTop">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
      顶部
    </button>
  </nav>

  <DetailModal :post="detailPost" @close="viewingId = null" @like="toggleViewingLike"
               @favorite="toggleViewingFavorite" @copy="copyViewing" @delete="requestDeleteViewing" />

  <ConfirmModal v-if="pendingDeleteId" @close="pendingDeleteId = null" @confirm="handleConfirmDelete" />

  <Toast />
</template>
