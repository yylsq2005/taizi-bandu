<script setup lang="ts">
defineEmits<{
  close: []
  confirm: []
}>()
</script>

<template>
  <div class="modal" style="z-index: 88">
    <div class="modal__backdrop" @click="$emit('close')"></div>
    <div class="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title"
         aria-describedby="confirm-desc">
      <span class="confirm__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 7h16" />
          <path d="M9.6 7V5.5c0-.8.65-1.5 1.45-1.5h1.9c.8 0 1.45.7 1.45 1.5V7" />
          <path d="M6.6 7l.8 11.2c.06.8.72 1.3 1.5 1.3h6.2c.78 0 1.44-.5 1.5-1.3L17.4 7" />
          <path d="M10.6 11v5M13.4 11v5" />
        </svg>
      </span>
      <h2 id="confirm-title" class="confirm__title">删除这条片语？</h2>
      <p id="confirm-desc" class="confirm__desc">删除后无法恢复，内容会从这台设备上移除。</p>
      <div class="confirm__actions">
        <button type="button" class="btn-flat" @click="$emit('close')">再想想</button>
        <button type="button" class="btn-danger" @click="$emit('confirm')">删除</button>
      </div>
    </div>
  </div>
</template>
