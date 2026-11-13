<script setup lang="ts">
import { useFeedStore } from '../stores/feed'

defineEmits<{
  search: [tag: string]
}>()

const store = useFeedStore()

const HUES = [340, 268, 225, 190, 45]
</script>

<template>
  <aside class="side" aria-label="此刻热议">
    <section class="card side__card">
      <div class="side__head">
        <h2>此刻热议</h2>
        <span class="pulse-dot" aria-hidden="true"></span>
      </div>
      <ol class="topics">
        <li v-for="(topic, index) in store.topics" :key="topic.tag">
          <button type="button" class="topic" :data-topic="topic.tag" @click="$emit('search', topic.tag)">
            <span class="topic__rank" :style="{ '--h': String(HUES[index] ?? 268) }">{{ index + 1 }}</span>
            <span class="topic__name">{{ topic.tag }}</span>
            <span class="topic__count">{{ topic.count > 0 ? topic.count + ' 条' : '待开启' }}</span>
          </button>
        </li>
      </ol>
    </section>

    <section class="card side__card side__note">
      <div class="side__head">
        <h2>玩法提示</h2>
      </div>
      <p>点卡片右下角的<strong>「查看」</strong>立体按钮，可以展开全文、点赞或删除；数据全部存在浏览器本地。</p>
    </section>
  </aside>
</template>
