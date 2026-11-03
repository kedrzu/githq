<!-- The Jobs column of a run's page (actions W4a, `Workflow / Jobs`): how many jobs stand how, then the jobs — failed first — each with its state and how long it took, or its status. The selected job shows its steps, each with its state and time; a failed step and a running one stand out. While a search of the selected job's log finds anything, its matches show on the job and, in place of the time, on the steps that have them; other jobs' logs aren't read for it (actions D12). Placeholder rows while the jobs are on their way (W4e). A click selects a job; the keys are the page's (⌥J/⌥K). -->
<script lang="ts" setup>
import type { GitHubWorkflowJob, GitHubWorkflowStep } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, CircleCheck, CircleDashed, CircleSlash, CircleX, Loader } from 'lucide-vue-next';
import { computed } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { formatDuration } from '@/utils/formatDuration.js';

import type { WorkflowJobCounts } from './buildWorkflowRun.js';
import { formatTimeTaken } from './utils/formatTimeTaken.js';
import type { LogMatches } from './utils/findLogMatches.js';
import { getJobMark } from './utils/getJobMark.js';
import type { WorkflowJobMark } from './utils/getJobMark.js';
import * as l from './WorkflowRunJobs.loc.js';

const props = defineProps<{
  /** In the order shown. */
  jobs: readonly GitHubWorkflowJob[];
  counts: WorkflowJobCounts;
  selectedId: number | null;
  /** The jobs are on their way. */
  loading: boolean;
  /** Epoch ms what is running is counted to. */
  now: number;
  /** What a search found in the selected job's log; `null` with no search. */
  matches: LogMatches | null;
}>();

const emit = defineEmits<{
  /** A job was clicked. */
  select: [job: GitHubWorkflowJob];
}>();

const PLACEHOLDER_ROWS = 6;
const NUMBER_FORMAT = new Intl.NumberFormat(APP_LANGUAGE);

const JOB_ICONS = {
  failed: CircleX,
  running: Loader,
  waiting: CircleDashed,
  skipped: CircleSlash,
  passed: CircleCheck,
  none: CircleSlash,
} as const;
const STEP_ICONS = { ...JOB_ICONS, passed: Check };

const t = useTranslate();

/** "1 failed · 1 skipped · 5 passed". */
const summary = computed(() => {
  if (props.loading) {
    return t(l.reading);
  }

  const { failed, running, waiting, skipped, passed, none } = props.counts;
  const parts = [
    failed > 0 ? t(l.failed, { count: failed }) : null,
    running > 0 ? t(l.running, { count: running }) : null,
    waiting > 0 ? t(l.waiting, { count: waiting }) : null,
    skipped > 0 ? t(l.skipped, { count: skipped }) : null,
    passed > 0 ? t(l.passed, { count: passed }) : null,
    none > 0 ? t(l.other, { count: none }) : null,
  ];
  return parts.filter(part => part !== null).join(' · ');
});

function getTaken(mark: WorkflowJobMark, entry: GitHubWorkflowJob | GitHubWorkflowStep) {
  const { startedAt, completedAt } = entry;
  if (startedAt === null) {
    return null;
  }

  if (mark === 'running') {
    return formatDuration(props.now - Date.parse(startedAt));
  }

  return completedAt === null ? null : formatTimeTaken(startedAt, completedAt);
}

function describeJobTime(job: GitHubWorkflowJob) {
  const mark = getJobMark(job);
  switch (mark) {
    case 'waiting':
      return t(l.waitingTime);
    case 'skipped':
      return t(l.skippedTime);
    case 'none':
      return job.conclusion;
    case 'failed':
    case 'passed':
    case 'running':
      return getTaken(mark, job);
    default:
      return assertNever(mark);
  }
}

function describeStepTime(step: GitHubWorkflowStep) {
  const mark = getJobMark(step);
  return mark === 'failed' || mark === 'passed' || mark === 'running' ? getTaken(mark, step) : null;
}
</script>

<template>
  <nav
    :class="css.workflowRunJobs"
    :aria-label="t(l.jobs)"
  >
    <div :class="css.workflowRunJobs_head">
      <span :class="css.workflowRunJobs_title">{{ t(l.jobs) }}</span>
      <span :class="css.workflowRunJobs_summary">{{ summary }}</span>
    </div>
    <div
      v-if="loading"
      :class="css.workflowRunJobs_placeholders"
      aria-hidden="true"
      tid="workflow-jobs-placeholder"
    >
      <span
        v-for="row in PLACEHOLDER_ROWS"
        :key="row"
        :class="css.workflowRunJobs_placeholder"
      />
    </div>
    <ul
      v-else
      :class="css.workflowRunJobs_list"
    >
      <li
        v-for="job in jobs"
        :key="job.id"
      >
        <button
          type="button"
          :class="[css.workflowRunJobs_job, job.id === selectedId && css.workflowRunJobs_job_selected]"
          :aria-current="job.id === selectedId ? 'true' : undefined"
          :data-mark="getJobMark(job)"
          tid="workflow-job"
          @click="emit('select', job)"
        >
          <component
            :is="JOB_ICONS[getJobMark(job)]"
            :class="[css.workflowRunJobs_jobIcon, css[`workflowRunJobs_icon_${getJobMark(job)}`]]"
            aria-hidden="true"
          />
          <span
            :class="[css.workflowRunJobs_jobName, getJobMark(job) === 'skipped' && css.workflowRunJobs_jobName_quiet]"
            >{{ job.name }}</span
          >
          <span
            v-if="job.id === selectedId && matches && matches.lines.length > 0"
            :class="css.workflowRunJobs_matches"
            tid="workflow-job-matches"
            >{{ NUMBER_FORMAT.format(matches.lines.length)
            }}<span :class="css.workflowRunJobs_hidden"> {{ t(l.matches) }}</span></span
          >
          <span :class="css.workflowRunJobs_jobTime">{{ describeJobTime(job) }}</span>
        </button>
        <ul
          v-if="job.id === selectedId && job.steps.length > 0"
          :class="css.workflowRunJobs_list"
        >
          <li
            v-for="step in job.steps"
            :key="step.number"
            :class="[
              css.workflowRunJobs_step,
              (getJobMark(step) === 'failed' || getJobMark(step) === 'running') && css.workflowRunJobs_step_marked,
            ]"
            :data-mark="getJobMark(step)"
            tid="workflow-step"
          >
            <component
              :is="STEP_ICONS[getJobMark(step)]"
              :class="[css.workflowRunJobs_stepIcon, css[`workflowRunJobs_icon_${getJobMark(step)}`]]"
              aria-hidden="true"
            />
            <span
              v-if="getJobMark(step) === 'failed'"
              :class="css.workflowRunJobs_hidden"
              >{{ t(l.stepFailed) }}</span
            >
            <span
              :class="[
                css.workflowRunJobs_stepName,
                getJobMark(step) === 'failed' || getJobMark(step) === 'running'
                  ? css.workflowRunJobs_stepName_marked
                  : (getJobMark(step) === 'skipped' || getJobMark(step) === 'waiting') &&
                    css.workflowRunJobs_stepName_quiet,
              ]"
              >{{ step.name }}</span
            >
            <span
              v-if="matches?.steps.has(step.number)"
              :class="css.workflowRunJobs_matches"
              tid="workflow-step-matches"
              >{{ NUMBER_FORMAT.format(matches.steps.get(step.number) ?? 0)
              }}<span :class="css.workflowRunJobs_hidden"> {{ t(l.matches) }}</span></span
            >
            <span
              v-else
              :class="css.workflowRunJobs_stepTime"
              >{{ describeStepTime(step) }}</span
            >
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>

<style lang="scss" module="css">
// The design's column.
$jobs-width: 268px;

.workflowRunJobs {
  flex: none;
  width: $jobs-width;
  padding: $spacing-10 $spacing-8;
  overflow-y: auto;
  border-right: 1px solid $color-border;
}

.workflowRunJobs_head {
  display: flex;
  gap: $spacing-8;
  align-items: baseline;
  padding: 0 $spacing-8 $spacing-6;
  font-size: $font-size-xs;
}

.workflowRunJobs_title {
  flex: none;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.workflowRunJobs_summary {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunJobs_placeholders {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  padding: $spacing-8;
}

.workflowRunJobs_placeholder {
  @include placeholder-bar;
}

.workflowRunJobs_list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.workflowRunJobs_job {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  padding: $spacing-5 $spacing-8;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: default;
  background: none;
  border: none;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-2;
  }

  &:focus-visible {
    outline: 2px solid $color-focus;
    outline-offset: -2px;
  }
}

.workflowRunJobs_job_selected {
  &,
  &:hover {
    background: $color-sel;
  }
}

.workflowRunJobs_jobIcon {
  flex: none;
  width: 13px;
  height: 13px;
}

.workflowRunJobs_stepIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.workflowRunJobs_icon_failed {
  color: $color-red;
}

.workflowRunJobs_icon_running {
  color: $color-amber;
}

.workflowRunJobs_icon_passed {
  color: $color-green;
}

.workflowRunJobs_icon_waiting,
.workflowRunJobs_icon_skipped,
.workflowRunJobs_icon_none {
  color: $color-fg-3;
}

// A step's tick is quieter than a job's: its job already says it passed.
.workflowRunJobs_step .workflowRunJobs_icon_passed {
  color: $color-fg-3;
}

.workflowRunJobs_jobName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunJobs_jobName_quiet {
  color: $color-fg-dim;
}

.workflowRunJobs_jobTime {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.workflowRunJobs_step {
  display: flex;
  gap: $spacing-7;
  align-items: center;
  padding: 3px $spacing-8 3px 29px;
  border-radius: 5px;
}

.workflowRunJobs_step_marked {
  background: $color-bg-3;
}

.workflowRunJobs_hidden {
  @include visually-hidden;
}

.workflowRunJobs_stepName {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunJobs_stepName_marked {
  color: $color-fg;
}

.workflowRunJobs_stepName_quiet {
  color: $color-fg-dim;
}

.workflowRunJobs_matches {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-accent;
}

.workflowRunJobs_stepTime {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-fg-dim;
}
</style>
