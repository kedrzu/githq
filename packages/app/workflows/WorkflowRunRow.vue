<!-- One run of an opened workflow (actions W53, W54): on its first line its mark — failed, passed, still going, one that says nothing —, its title and its number, muted; on the second, its result in words, in the mark's colour — "Failed after 3m 12s · 14m ago", "Running for 1m 04s · 1m ago", "Passed in 4m 02s · 4h ago", "Cancelled · Yesterday", "Queued" —, then the ref it ran on as a chip (a branch's or a tag's icon, mono; on the selected row on a violet tint that keeps its text readable), what started it as an icon and a short word (push, PR, manual, schedule…) and who, their picture and login — the login left out when the list is narrow. Everything follows what it belongs to: nothing is pinned to the row's end. The whole row is its button. -->
<script lang="ts" setup>
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  GitCommitHorizontal,
  GitPullRequest,
  LoaderCircle,
  Play,
  Zap,
} from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import { formatDuration } from '@/utils/formatDuration.js';

import { useDescribeRunWhen } from './useDescribeRunWhen.js';
import { describeWorkflowRun } from './utils/describeWorkflowRun.js';
import { isPullRequestRun } from './utils/isPullRequestRun.js';
import WorkflowRefLabel from './WorkflowRefLabel.vue';
import * as l from './WorkflowRunRow.loc.js';
import type { WorkflowRowRef } from './WorkflowTypes.js';

const props = withDefaults(
  defineProps<{
    run: GitHubWorkflowRun;
    /** The ref it ran on; `null` when GitHub names none. */
    gitRef: WorkflowRowRef | null;
    /** Epoch ms the ages are counted to. */
    now: number;
    selected?: boolean;
  }>(),
  { selected: false },
);

const emit = defineEmits<{
  /** The row was clicked: the caller opens the run. */
  open: [];
}>();

/** How the row's mark and result are coloured. */
type RowTone = 'failed' | 'passed' | 'running' | 'waiting' | 'none';

const ICONS: Readonly<Record<RowTone, LucideIcon>> = {
  failed: CircleX,
  passed: CircleCheck,
  running: LoaderCircle,
  waiting: CircleDashed,
  none: CircleSlash,
};

const t = useTranslate();
const describeRunWhen = useDescribeRunWhen();

const description = computed(() => describeWorkflowRun(props.run, props.now));
/** A run not finished is running once it is in progress, waiting before. */
const tone = computed((): RowTone => {
  const { mark } = description.value;
  return mark === 'running' && props.run.status !== 'in_progress' ? 'waiting' : mark;
});
/** The result in words, and what follows it in dim: "Failed" "after 3m 12s". */
const result = computed((): { word: string; detail: string | null } => {
  const { mark, tail } = description.value;
  const duration = tail?.kind === 'duration' || tail?.kind === 'running' ? formatDuration(tail.ms) : null;
  switch (mark) {
    case 'failed':
      return { word: t(l.failed), detail: duration && t(l.after, { duration }) };
    case 'passed':
      return { word: t(l.passed), detail: duration && t(l.in, { duration }) };
    case 'running':
      return props.run.status === 'in_progress'
        ? { word: t(l.running), detail: duration && t(l.for, { duration }) }
        : { word: describeWaiting(), detail: null };
    case 'none':
      return { word: describeNone(), detail: null };
    default:
      return assertNever(mark);
  }
});
/** A run waiting to start says nothing of when: it is "Queued". */
const when = computed(() => (tone.value === 'waiting' ? null : describeRunWhen(props.run.createdAt, props.now)));
const event = computed((): { icon: LucideIcon; word: string } => {
  const { event: name } = props.run;
  if (isPullRequestRun(props.run)) {
    return { icon: GitPullRequest, word: t(l.eventPullRequest) };
  }

  switch (name) {
    case 'push':
      return { icon: GitCommitHorizontal, word: t(l.eventPush) };
    case 'workflow_dispatch':
      return { icon: Play, word: t(l.eventManual) };
    case 'schedule':
      return { icon: CalendarClock, word: t(l.eventSchedule) };
    default:
      return { icon: Zap, word: name.replaceAll('_', ' ') };
  }
});

function describeWaiting() {
  switch (props.run.status) {
    case 'queued':
    case 'pending':
    case 'requested':
      return t(l.queued);
    case 'waiting':
      return t(l.waiting);
    default:
      return capitalize(props.run.status.replaceAll('_', ' '));
  }
}

function describeNone() {
  switch (props.run.conclusion) {
    case 'cancelled':
      return t(l.cancelled);
    case 'skipped':
      return t(l.skipped);
    default:
      return capitalize((props.run.conclusion ?? '').replaceAll('_', ' '));
  }
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
</script>

<template>
  <button
    type="button"
    :class="[css.workflowRunRow, selected && css.workflowRunRow_selected]"
    :aria-current="selected ? 'true' : undefined"
    :data-tone="tone"
    @click="emit('open')"
  >
    <span :class="css.workflowRunRow_line">
      <component
        :is="ICONS[tone]"
        :class="[css.workflowRunRow_mark, css[`workflowRunRow_tone_${tone}`]]"
        aria-hidden="true"
      />
      <span :class="css.workflowRunRow_title">{{ run.displayTitle }}</span>
      <span :class="css.workflowRunRow_number">#{{ run.runNumber }}</span>
    </span>
    <span :class="[css.workflowRunRow_line, css.workflowRunRow_meta]">
      <span :class="css.workflowRunRow_result">
        <span :class="[css.workflowRunRow_word, css[`workflowRunRow_word_${tone}`]]">{{ result.word }}</span>
        <span
          v-if="result.detail"
          :class="css.workflowRunRow_dim"
          >{{ result.detail }}</span
        >
        <template v-if="when">
          <span
            :class="css.workflowRunRow_dot"
            aria-hidden="true"
            >·</span
          >
          <span :class="css.workflowRunRow_dim">{{ when }}</span>
        </template>
      </span>
      <span
        v-if="gitRef"
        :class="css.workflowRunRow_ref"
      >
        <WorkflowRefLabel
          :name="gitRef.name"
          :kind="gitRef.kind"
          compact
        />
      </span>
      <span :class="css.workflowRunRow_event">
        <component
          :is="event.icon"
          :class="css.workflowRunRow_eventIcon"
          aria-hidden="true"
        />
        {{ event.word }}
      </span>
      <span
        v-if="run.actor"
        :class="css.workflowRunRow_actor"
      >
        <Avatar
          :name="run.actor.login"
          :src="run.actor.avatarUrl"
          size="xs"
        />
        <span :class="css.workflowRunRow_login">{{ run.actor.login }}</span>
      </span>
    </span>
  </button>
</template>

<style lang="scss" module="css">
.workflowRunRow {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  width: 100%;
  padding: $spacing-8 $spacing-16 $spacing-8 $spacing-16;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: default;
  background: none;
  border: none;

  @include workflow-line-button;
}

.workflowRunRow_selected {
  @include row-selected;
}

.workflowRunRow_line {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
}

.workflowRunRow_meta {
  gap: $spacing-12;
  padding-left: calc(#{$workflow-icon-size} + #{$spacing-8});
  font-size: $font-size-xs;
}

.workflowRunRow_mark {
  flex: none;
  width: $workflow-icon-size;
  height: $workflow-icon-size;
}

.workflowRunRow_tone_failed {
  color: $color-red;
}

.workflowRunRow_tone_passed {
  color: $color-green;
}

.workflowRunRow_tone_running {
  color: $color-amber;
}

.workflowRunRow_tone_waiting,
.workflowRunRow_tone_none {
  color: $color-fg-3;
}

.workflowRunRow_title {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunRow_number {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.workflowRunRow_result {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: baseline;
  white-space: nowrap;
}

.workflowRunRow_word {
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.workflowRunRow_word_failed {
  color: $color-red;
}

.workflowRunRow_word_running {
  color: $color-amber;
}

.workflowRunRow_dim,
.workflowRunRow_dot {
  color: $color-fg-dim;
}

.workflowRunRow_ref {
  display: inline-flex;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 260px;
  padding: $spacing-2 $spacing-6;
  background: $color-bg-3;
  border-radius: $radius-sm;

  // On the selected row's tinted surface: a violet tint, its text kept at least 4.5:1 (W53).
  .workflowRunRow_selected & {
    background: rgba($color-accent, 0.15);
  }
}

.workflowRunRow_event,
.workflowRunRow_actor {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  color: $color-fg-2;
  white-space: nowrap;
}

.workflowRunRow_eventIcon {
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

// A narrow list (W54) shows who started the run by their picture alone.
@container (width < 560px) {
  .workflowRunRow_login {
    display: none;
  }
}
</style>
