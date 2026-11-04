<!-- The status bar's segment of a list or an item (D15): how fresh what it shows is — dim "Up to date" most of the time, or on a run's page what its log is doing (W4e, W4i, W4j); amber with since when and why when it is not. A review says how far its files are, and in amber that they wait for the API allowance or that GitHub lists only some (code review D35), or the review threads it didn't give, or they waiting for the allowance, and with files selected the keys that act on them (CR23); on a thread, which of them it is and the keys that walk them (CR15); just opened and not moved yet, why it starts where it does (CR20, CR25, CR26). Up to date, hovering it tells how long ago it was checked, ticking. A saved view githq can't evaluate says, in purple, that GitHub answers it and why it is slower (K6). Paused by the API allowance (K3), the screen's segment adds that the user's edits still go through. The user's own edits come first (D15): "Sending 2 changes · portal#1187" while on their way, and in red "1 change failed · …" until the failure is dismissed — clicking that shows its message again; a merge GitHub has not said the end of, in grey, until the next refresh settles it (merging PM36). -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  ArrowDownToLine,
  Check,
  CircleHelp,
  CircleX,
  Cloud,
  History,
  LoaderCircle,
  MessageSquare,
  MousePointerClick,
  Pause,
  RefreshCw,
  Send,
  TriangleAlert,
  Undo2,
} from 'lucide-vue-next';
import { computed } from 'vue';

import Tooltip from '@/components/Tooltip.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { useNow } from '@/services/useNow.js';
import type { Freshness } from '@/sync/Freshness.js';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';
import { formatTime } from '@/utils/formatTime.js';

import * as l from './FreshnessSegment.loc.js';
import type { SegmentEdits } from './SegmentEdits.js';
import StatusSegment from './StatusSegment.vue';

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
const now = useNow(TICK_MS, () => props.freshness.kind === 'fresh' || props.freshness.kind === 'statusChecked');
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

const look = computed((): SegmentLook => {
  const { freshness, edits } = props;
  if (edits) {
    switch (edits.kind) {
      case 'sending':
        return { icon: Send, tone: 'muted', text: edits.text };
      case 'unanswered':
        return { icon: CircleHelp, tone: 'muted', text: edits.text };
      case 'failed':
        return { icon: CircleX, tone: 'danger', text: edits.text };
      default:
        return assertNever(edits.kind);
    }
  }

  switch (freshness.kind) {
    case 'fresh':
      return { icon: Check, tone: 'dim', text: t(l.upToDate) };
    case 'checking':
      return { icon: RefreshCw, tone: 'dim', text: t(l.checking) };
    case 'partial':
      return { icon: LoaderCircle, tone: 'muted', text: t(l.downloading) };
    case 'reading':
      return {
        icon: LoaderCircle,
        tone: 'muted',
        text: t(l.readingRuns, { read: freshness.read, total: freshness.total }),
      };
    case 'readingLog':
      return { icon: LoaderCircle, tone: 'muted', text: t(l.readingLog, { job: freshness.job }) };
    case 'logFailed':
      return { icon: TriangleAlert, tone: 'warning', text: t(l.logFailed, { job: freshness.job }) };
    case 'statusChecked':
      return {
        icon: Check,
        tone: 'dim',
        text: t(l.statusChecked, { age: formatCheckedAge(freshness.checkedAt, now.value) }),
      };
    case 'filling':
      return {
        icon: LoaderCircle,
        tone: 'muted',
        text: t(l.filling, { done: freshness.done, total: freshness.total }),
      };
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
    case 'fetchingFiles':
      return { icon: LoaderCircle, tone: 'dim', text: getFetchingText(freshness) };
    case 'filesPaused':
      return {
        icon: Pause,
        tone: 'warning',
        text: t(l.filesPaused, {
          count: freshness.waiting,
          formatted: numbers.format(freshness.waiting),
          time: formatTime(freshness.until),
        }),
      };
    case 'filesCapped':
      return {
        icon: TriangleAlert,
        tone: 'warning',
        text: t(l.filesCapped, { listed: numbers.format(freshness.listed), total: numbers.format(freshness.total) }),
      };
    case 'filesUnread':
      return { icon: TriangleAlert, tone: 'warning', text: t(l.filesUnread) };
    case 'threadsUnread':
      return { icon: TriangleAlert, tone: 'warning', text: t(l.threadsUnread) };
    case 'threadsPaused':
      return {
        icon: Pause,
        tone: 'warning',
        text: t(l.threadsPaused, { time: formatTime(freshness.until) }),
      };
    case 'threadPosition':
      return {
        icon: MessageSquare,
        tone: 'dim',
        text: t(l.threadPosition, {
          position: numbers.format(freshness.position),
          total: numbers.format(freshness.total),
          open: numbers.format(freshness.open),
        }),
      };
    case 'landing':
      return {
        icon: freshness.at === 'firstFile' ? ArrowDownToLine : Undo2,
        tone: 'dim',
        text: getLandingText(freshness),
      };
    case 'filesSelected':
      return { icon: MousePointerClick, tone: 'dim', text: t(l.filesSelected) };
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
        case 'workflowsUnavailable':
          return { icon: TriangleAlert, tone: 'warning', text: t(l.workflowsUnavailable) };
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

function getLandingText(landing: Extract<Freshness, { kind: 'landing' }>) {
  switch (landing.at) {
    case 'firstFile': {
      const { number, viewed, total, backTo } = landing;
      return backTo
        ? t(l.landedFirstFileWalked, { number, key: backTo.key, back: backTo.number })
        : t(l.landedFirstFile, { viewed: numbers.format(viewed), total: numbers.format(total) });
    }
    case 'left': {
      const { number, file, line } = landing;
      return line === null
        ? t(l.landedLeft, { number, file })
        : t(l.landedLeftLine, { number, file, line: numbers.format(line) });
    }
    default:
      return assertNever(landing);
  }
}

function getFetchingText({ here, total, first, listComplete }: Extract<Freshness, { kind: 'fetchingFiles' }>) {
  const others = total - here - 1;
  if (first !== null) {
    return others > 0
      ? t(l.fetchingFirst, { name: first, others: numbers.format(others) })
      : t(l.fetchingOnly, { name: first });
  }

  const counts = { here: numbers.format(here), total: numbers.format(total) };
  return listComplete ? t(l.fetchingListed, counts) : t(l.fetching, counts);
}

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
