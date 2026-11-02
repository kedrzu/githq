<!-- One workflow on one line (actions W2, W3a): its state icon, its name — "by GitHub" when GitHub generates it —, its repository on the cross-repository screen, the ref or pattern it is read on (a branch or a tag, "+2" when it is broken on more), its last runs (`RunStrip`, in the same column on every row), how it stands ("Broken for 3h", "Passing · #88 running 1m") and its last result ("failed 14m ago"). Bright red while a break is younger than a day, quiet red after. The name is the row's button: it reaches the row by Tab and clicking anywhere on the row presses it. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CircleCheck, CircleDashed, CircleSlash, CircleX, GitBranch, Tag } from 'lucide-vue-next';
import { computed, useId } from 'vue';

import { formatAge } from '@/utils/formatAge.js';
import { formatLocalDate } from '@/utils/formatLocalDate.js';

import RunStrip from './RunStrip.vue';
import { getRunVerdict } from './utils/getRunVerdict.js';
import * as l from './WorkflowRow.loc.js';
import type { WorkflowRowRef, WorkflowState } from './WorkflowTypes.js';

const props = withDefaults(
  defineProps<{
    workflow: WorkflowState;
    /** Epoch ms the ages are counted to. */
    now: number;
    /** The ref or pattern the row names; `null` names none. */
    gitRef: WorkflowRowRef | null;
    /** How many more patterns the workflow is broken on: "+2". */
    moreRefCount?: number;
    /** `owner/name`, on the cross-repository screen; a repository's own tab names none. */
    repository?: string | null;
    selected?: boolean;
  }>(),
  { moreRefCount: 0, repository: null, selected: false },
);

const emit = defineEmits<{
  /** The row was clicked or its button pressed: the caller opens the workflow's latest failed run, or the workflow. */
  open: [];
}>();

interface RowLook {
  readonly icon: LucideIcon;
  readonly tone: 'muted' | 'new' | 'passing' | 'quiet';
  readonly status: string;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const WEEK = 7 * DAY;
/** From three weeks on a break is counted in weeks: "Broken for 19 days", then "Broken for 3 weeks". */
const WEEKS_FROM = 3;

const t = useTranslate();
const id = useId();

const look = computed((): RowLook => {
  const { workflow } = props;
  switch (workflow.state) {
    case 'broken':
      return {
        icon: CircleX,
        tone: workflow.isNew ? 'new' : 'quiet',
        status: withRunning(describeBreak()),
      };
    case 'passing':
      return { icon: CircleCheck, tone: 'passing', status: withRunning(t(l.passing)) };
    case 'unknown':
      return { icon: CircleDashed, tone: 'muted', status: withRunning(t(l.noVerdictYet)) };
    case 'disabled':
      return { icon: CircleSlash, tone: 'muted', status: t(l.disabled) };
    default:
      return assertNever(workflow.state);
  }
});
const lastResult = computed(() => {
  const { workflow } = props;
  if (workflow.state === 'broken' && workflow.latestFailedRun) {
    return t(l.failedWhen, { when: describeWhen(workflow.latestFailedRun.createdAt) });
  }

  const withVerdict =
    workflow.state === 'disabled' ? null : workflow.lastRuns.findLast(run => getRunVerdict(run) !== null);
  if (withVerdict) {
    const when = describeWhen(withVerdict.createdAt);
    return getRunVerdict(withVerdict) === 'failed' ? t(l.failedWhen, { when }) : t(l.passedWhen, { when });
  }

  const latest = workflow.lastRuns.at(-1);
  return latest ? t(l.lastRanWhen, { when: describeWhen(latest.createdAt) }) : null;
});
// A break's failures are news for its first day; every other failure in the strip is quiet.
const newSince = computed(() => (props.workflow.isNew ? props.workflow.breakStartedAt : null));

function describeBreak() {
  const { breakStartedAt, breakStartKnown } = props.workflow;
  if (breakStartedAt === null) {
    return t(l.broken);
  }

  const elapsed = props.now - breakStartedAt;
  if (elapsed < DAY) {
    const age = formatAge(breakStartedAt, props.now);
    return breakStartKnown ? t(l.brokenFor, { age }) : t(l.brokenForOrMore, { age });
  }

  const weeks = Math.floor(elapsed / WEEK);
  if (weeks >= WEEKS_FROM) {
    return t(breakStartKnown ? l.brokenForWeeks : l.brokenForWeeksOrMore, { count: weeks });
  }

  const days = Math.floor(elapsed / DAY);
  return t(breakStartKnown ? l.brokenForDays : l.brokenForDaysOrMore, { count: days });
}

function withRunning(status: string) {
  const running = props.workflow.runningRun;
  if (!running) {
    return status;
  }

  return t(l.withRunning, {
    status,
    number: running.runNumber,
    age: formatAge(Date.parse(running.createdAt), props.now),
  });
}

function describeWhen(createdAt: string) {
  const at = Date.parse(createdAt);
  return props.now - at < DAY ? t(l.ago, { age: formatAge(at, props.now) }) : formatLocalDate(at);
}
</script>

<template>
  <div :class="[css.workflowRow, selected && css.workflowRow_selected]">
    <component
      :is="look.icon"
      :class="[css.workflowRow_icon, css[`workflowRow_icon_${look.tone}`]]"
      aria-hidden="true"
    />
    <span :class="css.workflowRow_nameCell">
      <button
        type="button"
        :class="[css.workflowRow_name, workflow.state === 'disabled' && css.workflowRow_name_muted]"
        :aria-current="selected ? 'true' : undefined"
        :aria-describedby="`${id}-status ${id}-result`"
        @click="emit('open')"
      >
        <span :class="css.workflowRow_nameText">{{ workflow.workflow.name }}</span>
        <span
          v-if="workflow.generated"
          :class="css.workflowRow_byGitHub"
          >{{ t(l.byGitHub) }}</span
        >
      </button>
    </span>
    <span
      v-if="repository"
      :class="css.workflowRow_repository"
      >{{ repository }}</span
    >
    <span :class="css.workflowRow_refCell">
      <template v-if="gitRef">
        <component
          :is="gitRef.kind === 'tag' ? Tag : GitBranch"
          :class="css.workflowRow_refIcon"
          aria-hidden="true"
        />
        <span :class="css.workflowRow_ref">{{ gitRef.name }}</span>
        <span
          v-if="moreRefCount > 0"
          :class="css.workflowRow_moreRefs"
          >{{ t(l.moreRefs, { count: moreRefCount }) }}</span
        >
      </template>
    </span>
    <RunStrip
      :class="css.workflowRow_strip"
      :runs="workflow.lastRuns"
      :new-since="newSince"
    />
    <span
      :id="`${id}-status`"
      :class="[css.workflowRow_status, css[`workflowRow_status_${look.tone}`]]"
      >{{ look.status }}</span
    >
    <span
      :id="`${id}-result`"
      :class="css.workflowRow_result"
      >{{ lastResult }}</span
    >
  </div>
</template>

<style lang="scss" module="css">
// The design's columns, fixed so the strip sits in one column on every row.
$name-width: 230px;
$repository-width: 130px;
$ref-width: 130px;
$row-height: 34px;

.workflowRow {
  position: relative;
  display: flex;
  gap: $spacing-10;
  align-items: center;
  height: $row-height;
  padding: 0 $spacing-16;
  cursor: default;

  &:hover {
    background: $color-bg-2;
  }
}

.workflowRow_selected,
.workflowRow_selected:hover {
  background: $color-sel;
  box-shadow: inset 2px 0 0 $color-accent;
}

.workflowRow_icon {
  flex: none;
  width: 15px;
  height: 15px;
}

.workflowRow_icon_new {
  color: $color-red;
}

.workflowRow_icon_quiet {
  color: $color-red-quiet;
}

.workflowRow_icon_passing {
  color: $color-green;
}

.workflowRow_icon_muted {
  color: $color-fg-3;
}

.workflowRow_nameCell {
  display: flex;
  flex: none;
  width: $name-width;
  min-width: 0;
}

// The row's button: its hit area stretches over the whole row, under the strip's ticks.
.workflowRow_name {
  display: flex;
  gap: $spacing-8;
  align-items: baseline;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  font: inherit;
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-align: left;
  cursor: default;
  background: none;
  border: none;

  &::after {
    position: absolute;
    inset: 0;
    content: '';
  }

  &:focus-visible {
    outline: none;
  }

  &:focus-visible::after {
    outline: 2px solid $color-focus;
    outline-offset: -2px;
  }
}

.workflowRow_name_muted {
  color: $color-fg-dim;
}

.workflowRow_nameText {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRow_byGitHub {
  flex: none;
  font-size: $font-size-2xs;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.workflowRow_repository {
  flex: none;
  width: $repository-width;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRow_refCell {
  display: flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  width: $ref-width;
  min-width: 0;
}

.workflowRow_refIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.workflowRow_ref {
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRow_moreRefs {
  flex: none;
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
}

// Above the row's button, so a tick opens its run.
.workflowRow_strip {
  z-index: 1;
}

.workflowRow_status {
  flex: 1;
  min-width: 0;
  padding-left: $spacing-10;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRow_status_new {
  color: $color-fg;
}

.workflowRow_status_muted {
  color: $color-fg-dim;
}

.workflowRow_result {
  flex: none;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}
</style>
