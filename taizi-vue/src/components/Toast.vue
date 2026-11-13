<script setup lang="ts">
import { useToast } from '../composables/toast'

const { message, visible } = useToast()
</script>

<template>
  <div class="toast" role="status" aria-live="polite" :hidden="!visible"
       :class="{ 'is-visible': visible }">{{ message }}</div>
</template>
