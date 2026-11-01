<!-- The first download (G6, D20): a step the user can leave as soon as their own work is in. "Open My work" (↵) waits only for the issues and pull requests that concern them; below, how far everything they chose is — overall, and per repository and project, open items first and closed ones last — and the organisations whose private repositories GitHub hides from githq. Leaving stops nothing. -->
<script lang="ts">
import type { TrackingProgress } from './TrackingTypes.js';

/** A row of the first download: a tracked repository or project, or an organisation hiding its private data. */
export type FirstDownloadRow =
  | {
      readonly kind: 'project' | 'repository';
      /** `owner/name`, or the project's title. */
      readonly name: string;
      readonly key: string;
      readonly isPrivate: boolean;
      readonly progress: TrackingProgress;
    }
  | { readonly kind: 'organization'; readonly name: string; readonly key: string };

/** How far everything chosen is. */
export interface FirstDownloadOverall {
  readonly done: number;
  /**
   * The items counted so far: a repository counts its closed items only once it starts on them, so this grows;
   * `null` before every tracked repository and project counted any.
   */
  readonly total: number | null;
  /** Every tracked repository and project has all its items. */
  readonly finished: boolean;
  /** How long the rest should take, from the pace so far; `null` while not known. */
  readonly secondsLeft: number | null;
}
</script>

<script lang="ts" setup>
import { sumOver } from '@nzyme/utils/array/sumOver.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { BookMarked, Check, CircleCheck, LoaderCircle, Lock, SquareKanban } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import ProgressBar from '@/components/ProgressBar.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { MyWorkCounts } from '@/myWork/buildMyWork.js';
import { formatDuration } from '@/utils/formatDuration.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';

import * as l from './FirstDownloadView.loc.js';

/** Folded into one row: the finished repositories after the first, when there are more rows than this. */
const UNFOLDED_ROWS = 6;

const props = defineProps<{
  /** "My work"'s counts once it has arrived; `null` until then. */
  myWork: MyWorkCounts | null;
  rows: readonly FirstDownloadRow[];
  overall: FirstDownloadOverall;
}>();

const emit = defineEmits<{
  /** "Open My work" (↵). */
  open: [];
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

const readyDetail = computed(() => {
  const counts = props.myWork;
  if (!counts) {
    return t(l.arrivingDetail);
  }

  const groups = [
    t(l.reviewRequests, { count: counts.reviewRequested }),
    t(l.pullRequests, { count: counts.authored }),
    t(l.assigned, { count: counts.assigned }),
    t(l.mentions, { count: counts.mentioned }),
  ].join(', ');
  return t(l.readyDetail, { count: counts.total, groups });
});

const shownRows = computed((): FirstDownloadRow[] => {
  if (props.rows.length <= UNFOLDED_ROWS) {
    return [...props.rows];
  }

  const finished = props.rows.filter(row => row.kind === 'repository' && row.progress.state === 'done');
  if (finished.length < 3) {
    return [...props.rows];
  }

  // The first stays as it is; the second stands for itself and the rest.
  const [, second, ...rest] = finished;
  const folded = new Set(rest.map(row => row.key));
  const items = sumOver([second, ...rest], row => (row?.kind === 'repository' ? row.progress.done : 0));

  const result: FirstDownloadRow[] = [];
  for (const row of props.rows) {
    if (row === second) {
      result.push({
        kind: 'repository',
        key: 'folded',
        name: t(l.andMore, { name: second.name, count: rest.length }),
        isPrivate: false,
        progress: { state: 'done', done: items, total: items },
      });
    } else if (!folded.has(row.key)) {
      result.push(row);
    }
  }

  return result;
});

const overallText = computed(() => {
  const { done, total, secondsLeft, finished } = props.overall;
  if (finished) {
    return t(l.allDone);
  }

  if (total === null) {
    return t(l.overallWaiting);
  }

  const counted =
    done >= total
      ? t(l.soFar, { count: done, formatted: numbers.format(done) })
      : t(l.overall, { done: numbers.format(done), total: numbers.format(total) });
  return secondsLeft === null ? counted : `${counted} · ${t(l.left, { time: formatDuration(secondsLeft * 1000) })}`;
});

onWindowEvent('keydown', event => {
  if (event.key === 'Enter' && props.myWork && isSingleKeyShortcut(event) && !isActivatableTarget(event.target)) {
    event.preventDefault();
    emit('open');
  }
});

function rowFraction(progress: TrackingProgress) {
  if (progress.state === 'done') {
    return 1;
  }

  // Not done while the closed items are still to be counted.
  return progress.total ? Math.min(progress.done / progress.total, 0.99) : null;
}

/** The overall bar: full only when all is in. */
function overallFraction(overall: FirstDownloadOverall) {
  if (overall.finished) {
    return 1;
  }

  return overall.total ? Math.min(overall.done / overall.total, 0.99) : null;
}

function rowDetail(progress: TrackingProgress) {
  switch (progress.state) {
    case 'done':
      return t(l.items, { count: progress.done });
    case 'hidden':
      return '';
    case 'downloading':
      return progress.total === null
        ? t(l.waiting)
        : t(l.itemsOf, { done: numbers.format(progress.done), total: numbers.format(progress.total) });
  }
}

function rowIcon(row: FirstDownloadRow) {
  if (row.kind === 'project') {
    return SquareKanban;
  }

  return row.kind === 'organization' || row.isPrivate ? Lock : BookMarked;
}
</script>

<template>
  <div :class="css.firstDownloadView">
    <div :class="css.firstDownloadView_heading">
      <h1 :class="css.firstDownloadView_title">{{ t(l.title) }}</h1>
      <p :class="css.firstDownloadView_subtitle">{{ t(l.subtitle) }}</p>
    </div>

    <div
      :class="[css.firstDownloadView_myWork, myWork && css.firstDownloadView_myWork_ready]"
      role="status"
    >
      <component
        :is="myWork ? CircleCheck : LoaderCircle"
        :class="[css.firstDownloadView_myWorkIcon, !myWork && css.firstDownloadView_spin]"
        aria-hidden="true"
      />
      <div :class="css.firstDownloadView_myWorkText">
        <p :class="css.firstDownloadView_myWorkTitle">{{ t(myWork ? l.ready : l.arriving) }}</p>
        <p :class="css.firstDownloadView_myWorkDetail">{{ readyDetail }}</p>
      </div>
      <Button
        variant="primary"
        kbd="Enter"
        aria-keyshortcuts="Enter"
        :disabled="!myWork"
        @click="emit('open')"
      >
        {{ t(l.open) }}
      </Button>
    </div>

    <div :class="css.firstDownloadView_overall">
      <div :class="css.firstDownloadView_overallLine">
        <span :class="css.firstDownloadView_overallName">{{ t(l.everything) }}</span>
        <span :class="css.firstDownloadView_overallText">{{ overallText }}</span>
      </div>
      <ProgressBar
        :value="overallFraction(overall)"
        :label="t(l.everything)"
      />
    </div>

    <ul
      v-if="shownRows.length > 0"
      :class="css.firstDownloadView_rows"
      :aria-label="t(l.progress)"
    >
      <li
        v-for="row in shownRows"
        :key="row.key"
        :class="css.firstDownloadView_row"
      >
        <component
          :is="rowIcon(row)"
          :class="[
            css.firstDownloadView_rowIcon,
            row.kind === 'organization' && css.firstDownloadView_amber,
            row.kind === 'project' && css.firstDownloadView_accent,
          ]"
          aria-hidden="true"
        />
        <span :class="[css.firstDownloadView_rowName, row.kind === 'organization' && css.firstDownloadView_dim]">{{
          row.name
        }}</span>
        <template v-if="row.kind === 'organization'">
          <span :class="[css.firstDownloadView_rowState, css.firstDownloadView_amber]">{{ t(l.privateHidden) }}</span>
        </template>
        <template v-else-if="row.progress.state === 'hidden'">
          <span :class="[css.firstDownloadView_rowState, css.firstDownloadView_amber]">{{
            t(l.hiddenRepository)
          }}</span>
        </template>
        <template v-else>
          <ProgressBar
            :class="css.firstDownloadView_rowBar"
            :value="rowFraction(row.progress)"
            :label="row.name"
          />
          <span :class="css.firstDownloadView_rowDetail">{{ rowDetail(row.progress) }}</span>
          <span
            v-if="row.progress.state === 'done'"
            :class="[css.firstDownloadView_rowState, css.firstDownloadView_green]"
          >
            <Check
              :class="css.firstDownloadView_check"
              aria-hidden="true"
            />
            {{ t(l.done) }}
          </span>
          <span
            v-else-if="row.progress.total"
            :class="css.firstDownloadView_rowState"
            >{{ Math.round((rowFraction(row.progress) ?? 0) * 100) }}%</span
          >
        </template>
      </li>
    </ul>

    <p :class="css.firstDownloadView_foot">{{ t(l.foot) }}</p>
  </div>
</template>

<style lang="scss" module="css">
.firstDownloadView {
  display: flex;
  flex-direction: column;
  gap: $spacing-24;
  width: 640px;
  max-width: calc(100% - 48px);
  padding: 56px 0 $spacing-24;
  margin: 0 auto;
}

.firstDownloadView_heading {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.firstDownloadView_title {
  font-size: 24px;
  font-weight: $font-weight-semibold;
  letter-spacing: -0.3px;
  color: $color-fg;
}

.firstDownloadView_subtitle {
  font-size: $font-size-lg;
  line-height: 21px;
  color: $color-fg-2;
}

.firstDownloadView_myWork {
  display: flex;
  gap: $spacing-12;
  align-items: center;
  padding: 14px $spacing-16;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-xl;
}

.firstDownloadView_myWork_ready {
  background: rgba($color-green, 0.06);
  border-color: rgba($color-green, 0.33);
}

.firstDownloadView_myWorkIcon {
  flex: none;
  width: 18px;
  height: 18px;
  color: $color-fg-2;

  .firstDownloadView_myWork_ready & {
    color: $color-green;
  }
}

.firstDownloadView_spin {
  animation: first-download-spin 1s linear infinite;
}

@keyframes first-download-spin {
  to {
    transform: rotate(360deg);
  }
}

.firstDownloadView_myWorkText {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.firstDownloadView_myWorkTitle {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.firstDownloadView_myWorkDetail {
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.firstDownloadView_overall {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.firstDownloadView_overallLine {
  display: flex;
  gap: $spacing-8;
  justify-content: space-between;
}

.firstDownloadView_overallName {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.firstDownloadView_overallText {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.firstDownloadView_rows {
  padding: 0;
  margin: 0;
  list-style: none;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}

.firstDownloadView_row {
  display: flex;
  gap: $spacing-12;
  align-items: center;
  padding: 10px 14px;

  & + & {
    border-top: 1px solid $color-border;
  }
}

.firstDownloadView_rowIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.firstDownloadView_rowName {
  flex: none;
  width: 220px;
  overflow: hidden;
  font-size: $font-size-md;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.firstDownloadView_rowBar {
  flex: none;
  width: 140px;
}

.firstDownloadView_rowDetail {
  flex: 1;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.firstDownloadView_rowState {
  display: inline-flex;
  flex: none;
  gap: 5px;
  align-items: center;
  margin-left: auto;
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.firstDownloadView_check {
  width: 12px;
  height: 12px;
}

.firstDownloadView_green {
  color: $color-green;
}

.firstDownloadView_amber {
  color: $color-amber;
}

.firstDownloadView_accent {
  color: $color-accent;
}

.firstDownloadView_dim {
  color: $color-fg-dim;
}

.firstDownloadView_foot {
  font-size: $font-size-sm;
  line-height: 19px;
  color: $color-fg-dim;
}
</style>
