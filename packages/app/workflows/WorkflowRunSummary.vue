<!-- What a run is (actions `Workflow / Run summary`): its state, the ref it ran on, what started it and which attempt past the first, its commit, and when and how long it took — or, while it goes, since when and whether its workflow stays broken. All of it from the local copy at once; the commit's whole title once the run itself is read. Placeholders only while nothing at all is known of the run. -->
<script lang="ts" setup>
import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import { formatDuration } from '@/utils/formatDuration.js';
import { getElapsedUnit } from '@/utils/getElapsedUnit.js';

import { useDescribeRunWhen } from './useDescribeRunWhen.js';
import { describeWorkflowRun } from './utils/describeWorkflowRun.js';
import WorkflowRefLabel from './WorkflowRefLabel.vue';
import * as l from './WorkflowRunSummary.loc.js';
import type { WorkflowRowRef } from './WorkflowTypes.js';

const props = defineProps<{
  /** `null` while nothing is known of it. */
  run: GitHubWorkflowRunDetail | null;
  /** The ref it ran on; `null` when GitHub names none. */
  gitRef: WorkflowRowRef | null;
  /** Its workflow is broken as things stand. */
  stillBroken: boolean;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const SHORT_SHA = 7;

const t = useTranslate();
const describeRunWhen = useDescribeRunWhen();

const description = computed(() => (props.run ? describeWorkflowRun(props.run, props.now) : null));
const state = computed(() => {
  const value = description.value;
  if (!value) {
    return '';
  }

  switch (value.mark) {
    case 'failed':
      return t(l.failed);
    case 'passed':
      return t(l.passed);
    case 'running':
      return props.run?.status === 'in_progress' || value.tail?.kind !== 'status' ? t(l.running) : value.tail.status;
    case 'none':
      return value.tail?.kind === 'conclusion' ? value.tail.conclusion : '';
    default:
      return assertNever(value.mark);
  }
});
const commitTitle = computed(() => {
  const { run } = props;
  return run?.headCommitMessage?.split('\n')[0] ?? run?.displayTitle ?? '';
});
const when = computed(() => {
  const { run, now, stillBroken } = props;
  if (!run) {
    return '';
  }

  const started = describeRunWhen(run.createdAt, now);
  if (run.status !== 'completed') {
    return stillBroken && run.workflowName !== null
      ? t(l.startedBroken, { when: started, workflow: run.workflowName })
      : t(l.startedWhen, { when: started });
  }

  const days = getElapsedUnit(now - Date.parse(run.createdAt), ['day'])?.count ?? 0;
  const dated = days > 0 ? t(l.daysAgo, { when: started, count: days }) : started;
  const tail = description.value?.tail;
  return tail?.kind === 'duration' ? t(l.tookWhen, { when: dated, duration: formatDuration(tail.ms) }) : dated;
});
/** "push · attempt 2"; only the event on the first. */
const event = computed(() => {
  const { run } = props;
  if (!run) {
    return '';
  }

  return run.runAttempt != null && run.runAttempt > 1
    ? t(l.eventAttempt, { event: run.event, attempt: run.runAttempt })
    : run.event;
});
</script>

<template>
  <div
    :class="css.workflowRunSummary"
    tid="workflow-run-summary"
  >
    <template v-if="run && description">
      <span
        :class="[css.workflowRunSummary_state, css[`workflowRunSummary_state_${description.mark}`]]"
        :data-mark="description.mark"
        >{{ state }}</span
      >
      <WorkflowRefLabel
        v-if="gitRef"
        :class="css.workflowRunSummary_ref"
        :name="gitRef.name"
        :kind="gitRef.kind"
      />
      <span :class="css.workflowRunSummary_event">{{ event }}</span>
      <span :class="css.workflowRunSummary_commit">
        <span :class="css.workflowRunSummary_sha">{{ run.headSha.slice(0, SHORT_SHA) }}</span>
        <span :class="css.workflowRunSummary_title">{{ commitTitle }}</span>
      </span>
      <span :class="css.workflowRunSummary_when">{{ when }}</span>
    </template>
    <span
      v-else
      :class="css.workflowRunSummary_placeholder"
      aria-hidden="true"
    />
  </div>
</template>

<style lang="scss" module="css">
.workflowRunSummary {
  display: flex;
  flex: none;
  gap: $spacing-12;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-16;
  font-size: $font-size-xs;
  border-bottom: 1px solid $color-border;
}

.workflowRunSummary_state {
  flex: none;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
  text-transform: capitalize;
}

.workflowRunSummary_state_failed {
  color: $color-red;
}

.workflowRunSummary_state_passed {
  color: $color-green;
}

.workflowRunSummary_state_running {
  color: $color-amber;
}

.workflowRunSummary_ref {
  flex: none;
  max-width: 240px;
}

// `fg-dim`, not the design's `fg-3`: text in `fg-3` misses AA contrast (`tokens.scss`).
.workflowRunSummary_event {
  flex: none;
  color: $color-fg-dim;
}

.workflowRunSummary_commit {
  display: flex;
  flex: 1;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
}

.workflowRunSummary_sha {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.workflowRunSummary_title {
  overflow: hidden;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunSummary_when {
  flex: none;
  color: $color-fg-dim;
  white-space: nowrap;
}

.workflowRunSummary_placeholder {
  width: 320px;
  height: 10px;
  background: $color-bg-3;
  border-radius: $radius-sm;
}
</style>
