<!-- What a tracked row says of how it stands (G8): synced how long ago, downloading, not shown to githq or refused (amber). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';

import * as l from './TrackedRowNote.loc.js';
import type { TrackedStatus } from './TrackingTypes.js';

const props = defineProps<{
  status: TrackedStatus;
  /** What "synced 14s ago" is counted from. */
  now: number;
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

const text = computed(() => statusText(props.status));
const amber = computed(() => props.status.kind === 'hidden' || props.status.kind === 'refused');

function statusText(status: TrackedStatus) {
  switch (status.kind) {
    case 'downloading':
      return status.total === null
        ? t(l.waiting)
        : t(l.downloading, { done: numbers.format(status.done), total: numbers.format(status.total) });
    case 'hidden':
      return t(l.hidden);
    case 'refused':
      return t(l.refused);
    case 'read': {
      const read = status.at === null ? t(l.neverRead) : t(l.synced, { age: formatCheckedAge(status.at, props.now) });
      return status.slower ? t(l.slower, { read }) : read;
    }
  }
}
</script>

<template>
  <span :class="[css.trackedRowNote, amber && css.trackedRowNote_amber]">{{ text }}</span>
</template>

<style lang="scss" module="css">
.trackedRowNote {
  color: $color-fg-dim;
}

// Over the colour of the column the row puts it in.
.trackedRowNote.trackedRowNote_amber {
  color: $color-amber;
}
</style>
