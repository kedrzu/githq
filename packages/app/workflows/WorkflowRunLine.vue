<!-- One run of an unfolded workflow on one line (actions W3b): its mark — failed, passed, still going, or one that says nothing —, its number, the ref it ran on (a branch or a tag), what started it (`push`, `pull_request`, …), its title, and at the end how long it took — how long it has been going, or its status, while it has not finished; its conclusion when it says nothing — and when it started. The whole line is its button. -->
<script lang="ts" setup>
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleCheck, CircleDot, CircleSlash, CircleX } from 'lucide-vue-next';
import { computed } from 'vue';

import { formatDuration } from '@/utils/formatDuration.js';

import { useDescribeRunWhen } from './useDescribeRunWhen.js';
import { describeWorkflowRun } from './utils/describeWorkflowRun.js';
import WorkflowRefLabel from './WorkflowRefLabel.vue';
import * as l from './WorkflowRunLine.loc.js';
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
  /** The line was clicked: the caller opens the run. */
  open: [];
}>();

const MARKS = {
  failed: CircleX,
  passed: CircleCheck,
  running: CircleDot,
  none: CircleSlash,
} as const;

const t = useTranslate();
const describeRunWhen = useDescribeRunWhen();

const description = computed(() => describeWorkflowRun(props.run, props.now));
const tailText = computed(() => {
  const { tail } = description.value;
  if (tail === null) {
    return null;
  }

  switch (tail.kind) {
    case 'duration':
      return formatDuration(tail.ms);
    case 'running':
      return t(l.running, { duration: formatDuration(tail.ms) });
    case 'status':
      return tail.status;
    case 'conclusion':
      return tail.conclusion;
    default:
      return assertNever(tail);
  }
});
const when = computed(() => describeRunWhen(props.run.createdAt, props.now));
</script>

<template>
  <button
    type="button"
    :class="[css.workflowRunLine, selected && css.workflowRunLine_selected]"
    :aria-current="selected ? 'true' : undefined"
    :data-mark="description.mark"
    @click="emit('open')"
  >
    <component
      :is="MARKS[description.mark]"
      :class="[css.workflowRunLine_mark, css[`workflowRunLine_mark_${description.mark}`]]"
      aria-hidden="true"
    />
    <span :class="css.workflowRunLine_number">#{{ run.runNumber }}</span>
    <span :class="css.workflowRunLine_refCell">
      <WorkflowRefLabel
        v-if="gitRef"
        :name="gitRef.name"
        :kind="gitRef.kind"
      />
    </span>
    <span :class="css.workflowRunLine_event">{{ run.event }}</span>
    <span :class="css.workflowRunLine_title">{{ run.displayTitle }}</span>
    <span
      v-if="tailText"
      :class="css.workflowRunLine_tail"
      >{{ tailText }}</span
    >
    <span :class="css.workflowRunLine_when">{{ when }}</span>
  </button>
</template>

<style lang="scss" module="css">
.workflowRunLine {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  width: 100%;
  height: 30px;
  padding: 0 $spacing-16 0 $workflow-run-indent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: default;
  background: none;
  border: none;

  @include workflow-line-button;
}

.workflowRunLine_selected {
  @include row-selected;
}

.workflowRunLine_mark {
  flex: none;
  width: 13px;
  height: 13px;
}

.workflowRunLine_mark_failed {
  color: $color-red;
}

.workflowRunLine_mark_passed {
  color: $color-green;
}

.workflowRunLine_mark_running {
  color: $color-amber;
}

.workflowRunLine_mark_none {
  color: $color-fg-3;
}

.workflowRunLine_number {
  flex: none;
  width: 48px;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
}

.workflowRunLine_refCell {
  display: flex;
  flex: none;
  width: 170px;
  min-width: 0;
}

.workflowRunLine_event {
  flex: none;
  width: 110px;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunLine_title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunLine_tail {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.workflowRunLine_when {
  flex: none;
  width: 66px;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  text-align: right;
  white-space: nowrap;
}
</style>
