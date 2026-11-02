<!-- What Settings' chooser says at the end of a row (G8): a tick that differs from what is tracked says what saving will do — "will be tracked" (accent), "will be untracked" (amber) — and a tracked row otherwise says how it stands: synced how long ago, downloading, not shown to githq or refused (amber). -->
<script lang="ts">
/** What saving will do to a row whose tick differs from what is tracked. */
export type TrackedChange = 'track' | 'untrack';
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';

import * as l from './TrackedRowNote.loc.js';
import type { TrackedStatus } from './TrackingTypes.js';

const props = defineProps<{
  /** Said first: what saving will do. */
  change: TrackedChange | null;
  /** How the tracked row stands; said when nothing is staged for it. */
  status: TrackedStatus | null;
  /** What "synced 14s ago" is counted from. */
  now: number;
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

const text = computed(() => {
  if (props.change) {
    return t(props.change === 'track' ? l.willTrack : l.willUntrack);
  }

  return props.status ? statusText(props.status) : '';
});
const amber = computed(() =>
  props.change ? props.change === 'untrack' : props.status?.kind === 'hidden' || props.status?.kind === 'refused',
);

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
  <span
    :class="[css.trackedRowNote, change === 'track' && css.trackedRowNote_accent, amber && css.trackedRowNote_amber]"
    >{{ text }}</span
  >
</template>

<style lang="scss" module="css">
.trackedRowNote {
  color: $color-fg-dim;
}

// Over the colour of the column the row puts it in.
.trackedRowNote.trackedRowNote_accent {
  color: $color-accent;
}

.trackedRowNote.trackedRowNote_amber {
  color: $color-amber;
}
</style>
