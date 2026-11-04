<script lang="ts" setup>
import { computed } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const props = defineProps<{
  additions: number;
  deletions: number;
}>();

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const added = computed(() => `+${numbers.format(props.additions)}`);
const removed = computed(() => `−${numbers.format(props.deletions)}`);
</script>

<template>
  <span :class="css.pullRequestSize">
    <span :class="css.pullRequestSize_added">{{ added }}</span>
    <span :class="css.pullRequestSize_removed">{{ removed }}</span>
  </span>
</template>

<style lang="scss" module="css">
.pullRequestSize {
  display: inline-flex;
  flex: none;
  gap: 6px;
  font-family: $font-family-mono;
}

.pullRequestSize_added {
  color: $color-diff-added;
}

.pullRequestSize_removed {
  color: $color-diff-removed;
}
</style>
