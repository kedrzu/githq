<!-- The quiet accent line over a review after a push (D35, CR62): how many files lost their viewed mark and which, with "Show only these" and a way to dismiss it. The mark itself is GitHub's; this only keeps its loss from going unnoticed. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { GitCommitHorizontal, X } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';

import * as l from './ReviewLostViewedBar.loc.js';
import { getFileName } from './utils/getFileName.js';

const props = defineProps<{
  /** The files that lost it: at least one. */
  paths: readonly string[];
}>();

const emit = defineEmits<{
  showOnly: [];
  dismiss: [];
}>();

const t = useTranslate();

const count = computed(() => ({ count: props.paths.length, formatted: numbers.format(props.paths.length) }));
const names = computed(() => props.paths.map(getFileName).join(', '));
</script>

<template>
  <div
    :class="css.reviewLostViewedBar"
    role="status"
  >
    <GitCommitHorizontal
      :class="css.reviewLostViewedBar_icon"
      aria-hidden="true"
    />
    <span :class="css.reviewLostViewedBar_title">{{ t(l.pushed) }}</span>
    <span
      :class="css.reviewLostViewedBar_detail"
      :title="paths.join('\n')"
      >{{ t(l.lost, { ...count, names }) }}</span
    >
    <Button
      size="sm"
      variant="outline"
      @click="emit('showOnly')"
    >
      {{ t(l.showOnly, count) }}
    </Button>
    <IconButton
      :icon="X"
      :label="t(l.dismiss)"
      @click="emit('dismiss')"
    />
  </div>
</template>

<style lang="scss" module="css">
.reviewLostViewedBar {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-10 0 $spacing-16;
  font-size: 12.5px;
  background: rgba($color-accent, 0.08);
  border-bottom: 1px solid rgba($color-accent, 0.25);
}

.reviewLostViewedBar_icon {
  flex: none;
  width: 15px;
  height: 15px;
  color: $color-accent;
}

.reviewLostViewedBar_title {
  flex: none;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.reviewLostViewedBar_detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
