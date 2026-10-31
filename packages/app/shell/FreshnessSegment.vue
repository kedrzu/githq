<!-- The status bar's segment of a list or an item (D15): how fresh what it shows is — dim "Up to date" most of the time, amber with since when and why when it is not. Up to date, hovering it tells how long ago it was checked, ticking. A saved view githq can't evaluate says, in purple, that GitHub answers it and why it is slower (K6). Paused by the API allowance (K3), the screen's segment adds that the user's edits still go through. The user's own edits come first (D15): "Sending 2 changes · portal#1187" while on their way, and in red "1 change failed · …" until the failure is dismissed — clicking that shows its message again. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { Check, CircleX, Cloud, History, LoaderCircle, RefreshCw, Send, TriangleAlert } from 'lucide-vue-next';
import { computed } from 'vue';

import Tooltip from '@/components/Tooltip.vue';
import { useNow } from '@/services/useNow.js';
import type { Freshness } from '@/sync/Freshness.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';
import { formatTime } from '@/utils/formatTime.js';

import * as l from './FreshnessSegment.loc.js';
import StatusSegment from './StatusSegment.vue';

/** The user's own edits of what the segment shows, said instead of its freshness. */
export interface SegmentEdits {
  readonly kind: 'failed' | 'sending';
  /** "Sending 2 changes · portal#1187". */
  readonly text: string;
}

const props = defineProps<{
  freshness: Freshness;
  /** The user's edits on their way, or one that failed. */
  edits?: SegmentEdits | null;
  /** While refresh is paused, says at its end that the user's edits still go through (K3) — the screen's segment. */
  editsHint?: boolean;
}>();

const emit = defineEmits<{
  /** The failed edit was clicked: its message again. */
  showFailure: [];
}>();

interface SegmentLook {
  icon: LucideIcon;
  tone: 'danger' | 'dim' | 'expected' | 'muted' | 'warning';
  text: string;
}

/** How often "checked 12s ago" moves on while up to date. */
const TICK_MS = 1000;

const t = useTranslate();
const now = useNow(TICK_MS, () => props.freshness.kind === 'fresh');

const look = computed((): SegmentLook => {
  const { freshness, edits } = props;
  if (edits) {
    return edits.kind === 'sending'
      ? { icon: Send, tone: 'muted', text: edits.text }
      : { icon: CircleX, tone: 'danger', text: edits.text };
  }

  switch (freshness.kind) {
    case 'fresh':
      return { icon: Check, tone: 'dim', text: t(l.upToDate) };
    case 'checking':
      return { icon: RefreshCw, tone: 'dim', text: t(l.checking) };
    case 'partial':
      return { icon: LoaderCircle, tone: 'muted', text: t(l.downloading) };
    case 'answered':
      return {
        icon: Cloud,
        tone: 'expected',
        text: t(freshness.checkedAt === null ? l.asking : l.answered, { term: freshness.term }),
      };
    case 'paused':
      return {
        icon: History,
        tone: 'warning',
        text:
          freshness.since === null
            ? t(l.pausedUntil, { time: formatTime(freshness.until) })
            : t(l.notRefreshedSince, { time: formatTime(freshness.since) }),
      };
    case 'stale':
      switch (freshness.reason) {
        case 'failing':
          return {
            icon: TriangleAlert,
            tone: 'warning',
            text:
              freshness.since === null ? t(l.failingNothingYet) : t(l.failing, { time: formatTime(freshness.since) }),
          };
        case 'refused':
          return {
            icon: TriangleAlert,
            tone: 'warning',
            text:
              freshness.since === null ? t(l.refusedNothingYet) : t(l.refused, { time: formatTime(freshness.since) }),
          };
        case 'offline':
          return {
            icon: History,
            tone: 'warning',
            text: freshness.since === null ? t(l.offline) : t(l.asOf, { time: formatTime(freshness.since) }),
          };
        case 'late':
          return { icon: History, tone: 'warning', text: t(l.asOf, { time: formatTime(freshness.since) }) };
        default:
          return assertNever(freshness);
      }
    default:
      return assertNever(freshness);
  }
});

// The hover of "Up to date" (D15).
const checked = computed(() => {
  const { freshness } = props;
  if (freshness.kind !== 'fresh' || props.edits) {
    return null;
  }

  return t(l.checkedAgo, { age: formatCheckedAge(freshness.checkedAt, now.value) });
});
</script>

<template>
  <Tooltip
    :text="checked ?? undefined"
    side="top"
    :disabled="checked === null"
  >
    <StatusSegment
      :icon="look.icon"
      :tone="look.tone"
      :action="edits?.kind === 'failed'"
      @click="emit('showFailure')"
    >
      {{ look.text }}
      <template
        v-if="editsHint && freshness.kind === 'paused' && !edits"
        #detail
        >{{ t(l.editsStillGo) }}</template
      >
    </StatusSegment>
  </Tooltip>
</template>
