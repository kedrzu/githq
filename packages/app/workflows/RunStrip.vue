<!-- A workflow's last five runs as ticks (actions W0), oldest to newest, the newest always in the rightmost slot so every row's latest run sits in one column. Height carries the verdict, so it reads without colour: failed tall (bright red while the break is news, quiet red otherwise), passed short and grey, no verdict (cancelled, skipped) a dash, running a hollow amber tick, a slot with no run known a hairline. Hovering a tick names the run. A tick, a new one every 10 px, is too small to aim at (D29), so a click goes to the row. Screen readers hear the runs in words instead. -->
<script lang="ts" setup>
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { formatLocalDate } from '@/utils/formatLocalDate.js';
import { formatTime } from '@/utils/formatTime.js';

import * as l from './RunStrip.loc.js';
import { RUN_STRIP_SLOTS } from './utils/getRepositoryWorkflowState.js';
import { getRunVerdict } from './utils/getRunVerdict.js';

const props = defineProps<{
  /** The latest runs, oldest first; the strip shows the last five. */
  runs: readonly GitHubWorkflowRun[];
  /**
   * Failures created at or after this (epoch ms) are news and bright red — a break younger than a day; `null` when
   * none is: every failure is quiet red.
   */
  newSince: number | null;
}>();

type TickKind = 'failed' | 'failedNew' | 'none' | 'passed' | 'running' | 'unknown';

interface Tick {
  readonly key: string;
  readonly kind: TickKind;
  readonly run: GitHubWorkflowRun | null;
}

const LIST = new Intl.ListFormat(APP_LANGUAGE, { style: 'long', type: 'unit' });

const t = useTranslate();

const runs = computed(() => props.runs.slice(-RUN_STRIP_SLOTS));
// Slots with no run known first, so the latest run is always in the last one.
const ticks = computed((): Tick[] => [
  ...Array.from({ length: RUN_STRIP_SLOTS - runs.value.length }, (_, index): Tick => ({
    key: `none-${index}`,
    kind: 'unknown',
    run: null,
  })),
  ...runs.value.map((run): Tick => ({ key: `${run.id}`, kind: getTickKind(run), run })),
]);
const summary = computed(() => {
  if (runs.value.length === 0) {
    return t(l.noRuns);
  }

  const words = runs.value.map(run => describeRun(run));
  return t(l.summary, { count: words.length, runs: LIST.format(words) });
});

function getTickKind(run: GitHubWorkflowRun): TickKind {
  if (run.status !== 'completed') {
    return 'running';
  }

  switch (getRunVerdict(run)) {
    case 'failed':
      return props.newSince !== null && Date.parse(run.createdAt) >= props.newSince ? 'failedNew' : 'failed';
    case 'passed':
      return 'passed';
    default:
      return 'none';
  }
}

function describeRun(run: GitHubWorkflowRun) {
  if (run.status !== 'completed') {
    return t(l.running);
  }

  switch (getRunVerdict(run)) {
    case 'failed':
      return t(l.failed);
    case 'passed':
      return t(l.passed);
    default:
      return t(l.noVerdict);
  }
}

function getRunTitle(run: GitHubWorkflowRun) {
  const at = Date.parse(run.createdAt);
  const params = { number: run.runNumber, date: formatLocalDate(at), time: formatTime(at) };
  return run.headBranch === null ? t(l.runTitleNoRef, params) : t(l.runTitle, { ...params, ref: run.headBranch });
}
</script>

<template>
  <span
    :class="css.runStrip"
    tid="run-strip"
  >
    <span :class="css.runStrip_summary">{{ summary }}</span>
    <!-- Said in words above; the ticks are for the eye, and a click on them is the row's. -->
    <span
      :class="css.runStrip_ticks"
      aria-hidden="true"
    >
      <template
        v-for="tick in ticks"
        :key="tick.key"
      >
        <span
          v-if="tick.run"
          :class="css.runStrip_tick"
          :title="getRunTitle(tick.run)"
        >
          <span
            :class="[css.runStrip_bar, css[`runStrip_bar_${tick.kind}`]]"
            tid="run-bar"
            :data-kind="tick.kind"
          />
        </span>
        <span
          v-else
          :class="css.runStrip_tick"
        >
          <span
            :class="[css.runStrip_bar, css.runStrip_bar_unknown]"
            tid="run-bar"
            data-kind="unknown"
          />
        </span>
      </template>
    </span>
  </span>
</template>

<style lang="scss" module="css">
// The design's tick: 7 wide, 3 apart, bottom-aligned in 14.
$tick-width: 7px;
$tick-gap: 3px;
$tick-height: 14px;

.runStrip {
  position: relative;
  display: inline-flex;
  flex: none;
}

.runStrip_summary {
  @include visually-hidden;
}

.runStrip_ticks {
  display: flex;
  gap: $tick-gap;
  align-items: flex-end;
  height: $tick-height;
}

// The whole column is the tick's target, not just its bar.
.runStrip_tick {
  display: flex;
  align-items: flex-end;
  width: $tick-width;
  height: 100%;
}

.runStrip_bar {
  width: 100%;
  border-radius: 1px;
}

.runStrip_bar_failedNew {
  height: $tick-height;
  background: $color-red;
}

.runStrip_bar_failed {
  height: $tick-height;
  background: $color-red-quiet;
}

.runStrip_bar_passed {
  height: 5px;
  background: $color-fg-3;
}

.runStrip_bar_none {
  height: $spacing-2;
  background: $color-fg-3;
}

.runStrip_bar_running {
  height: $tick-height;
  border: 1px solid $color-amber;
}

.runStrip_bar_unknown {
  height: 1px;
  background: $color-border-2;
}
</style>
