<!-- A run's overview on its page (actions W34), where a run with nothing failed opens: how it ended and how long it took ("Succeeded in 3m 54s"), how its jobs stand ("All 7 jobs passed."), its jobs over time — a bar per job from when it started to when it completed, against the first start and the last end, a running one to now — and about the run: who started it with what event on which ref, its commit, which attempt it is. No artifacts and no environment (actions D16). -->
<script lang="ts" setup>
import type { GitHubWorkflowRunDetail } from '@githq/github/rest/getWorkflowRun.js';
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleCheck, CircleSlash, CircleX, GitCommitHorizontal, Loader, RotateCcw, User } from 'lucide-vue-next';
import { computed } from 'vue';

import { formatDuration } from '@/utils/formatDuration.js';

import type { WorkflowJobCounts } from './buildWorkflowRun.js';
import { describeWorkflowRun } from './utils/describeWorkflowRun.js';
import { getJobMark } from './utils/getJobMark.js';
import { getJobTimeline } from './utils/getJobTimeline.js';
import * as l from './WorkflowRunOverview.loc.js';

const props = defineProps<{
  /** `null` while only its jobs are known. */
  run: GitHubWorkflowRunDetail | null;
  jobs: readonly GitHubWorkflowJob[];
  counts: WorkflowJobCounts;
  /** Epoch ms what is running is counted to. */
  now: number;
}>();

const SHORT_SHA = 7;
const MARK_ICONS = { failed: CircleX, passed: CircleCheck, running: Loader, none: CircleSlash } as const;

const t = useTranslate();

const description = computed(() => (props.run ? describeWorkflowRun(props.run, props.now) : null));
const headline = computed(() => {
  const value = description.value;
  if (!value) {
    return '';
  }

  const ms = value.tail?.kind === 'duration' || value.tail?.kind === 'running' ? value.tail.ms : null;
  const duration = ms === null ? null : formatDuration(ms);
  switch (value.mark) {
    case 'passed':
      return duration === null ? t(l.succeeded) : t(l.succeededIn, { duration });
    case 'failed':
      return duration === null ? t(l.failed) : t(l.failedIn, { duration });
    case 'running':
      return duration === null ? t(l.running) : t(l.runningFor, { duration });
    case 'none':
      return value.tail?.kind === 'conclusion' ? t(l.ended, { conclusion: value.tail.conclusion }) : '';
    default:
      return assertNever(value.mark);
  }
});
/** "All 7 jobs passed.", or how many stand how. */
const sentence = computed(() => {
  const { failed, running, waiting, skipped, passed, none } = props.counts;
  if (passed === props.jobs.length) {
    return t(l.allPassed, { count: passed });
  }

  const parts = [
    failed > 0 ? t(l.countFailed, { count: failed }) : null,
    running > 0 ? t(l.countRunning, { count: running }) : null,
    waiting > 0 ? t(l.countWaiting, { count: waiting }) : null,
    skipped > 0 ? t(l.countSkipped, { count: skipped }) : null,
    passed > 0 ? t(l.countPassed, { count: passed }) : null,
    none > 0 ? t(l.countOther, { count: none }) : null,
  ];
  return t(l.countsSentence, { counts: parts.filter(part => part !== null).join(' · ') });
});
const timeline = computed(() => getJobTimeline(props.jobs, props.now));
const startedBy = computed(() => {
  const { run } = props;
  if (!run?.actor) {
    return null;
  }

  return run.headBranch === null
    ? t(l.startedByNoRef, { actor: run.actor.login, event: run.event })
    : t(l.startedByValue, { actor: run.actor.login, event: run.event, ref: run.headBranch });
});
const commitTitle = computed(() => props.run?.headCommitMessage?.split('\n')[0] ?? props.run?.displayTitle ?? '');
</script>

<template>
  <section
    :class="css.workflowRunOverview"
    :aria-label="t(l.overview)"
    tid="workflow-run-overview"
  >
    <header
      v-if="description"
      :class="css.workflowRunOverview_head"
    >
      <h2 :class="css.workflowRunOverview_headline">
        <component
          :is="MARK_ICONS[description.mark]"
          :class="[css.workflowRunOverview_mark, css[`workflowRunOverview_mark_${description.mark}`]]"
          aria-hidden="true"
        />
        {{ headline }}
      </h2>
      <p :class="css.workflowRunOverview_sentence">{{ sentence }}</p>
    </header>

    <h3 :class="css.workflowRunOverview_title">{{ t(l.jobsOverTime) }}</h3>
    <ol
      :class="css.workflowRunOverview_timeline"
      tid="workflow-run-timeline"
    >
      <li
        v-for="bar in timeline"
        :key="bar.job.id"
        :class="css.workflowRunOverview_bar"
        :data-mark="getJobMark(bar.job)"
      >
        <span :class="css.workflowRunOverview_barName">{{ bar.job.name }}</span>
        <span
          :class="css.workflowRunOverview_track"
          aria-hidden="true"
        >
          <span
            v-if="bar.ms !== null"
            :class="[css.workflowRunOverview_fill, css[`workflowRunOverview_fill_${getJobMark(bar.job)}`]]"
            :style="{ left: `${bar.offset * 100}%`, width: `${bar.length * 100}%` }"
          />
        </span>
        <span :class="css.workflowRunOverview_barTime">{{
          bar.ms === null ? t(l.notStarted) : formatDuration(bar.ms)
        }}</span>
      </li>
    </ol>

    <template v-if="run">
      <h3 :class="css.workflowRunOverview_title">{{ t(l.aboutRun) }}</h3>
      <dl :class="css.workflowRunOverview_facts">
        <template v-if="startedBy">
          <dt :class="css.workflowRunOverview_term">{{ t(l.startedBy) }}</dt>
          <dd :class="css.workflowRunOverview_value">
            <User
              :class="css.workflowRunOverview_factIcon"
              aria-hidden="true"
            />
            {{ startedBy }}
          </dd>
        </template>
        <dt :class="css.workflowRunOverview_term">{{ t(l.commit) }}</dt>
        <dd :class="css.workflowRunOverview_value">
          <span :class="css.workflowRunOverview_commit">
            <GitCommitHorizontal
              :class="css.workflowRunOverview_factIcon"
              aria-hidden="true"
            />
            <span :class="css.workflowRunOverview_sha">{{ run.headSha.slice(0, SHORT_SHA) }}</span>
          </span>
          <span :class="css.workflowRunOverview_commitTitle">{{ commitTitle }}</span>
        </dd>
        <dt :class="css.workflowRunOverview_term">{{ t(l.attempt) }}</dt>
        <dd :class="css.workflowRunOverview_value">
          <RotateCcw
            :class="css.workflowRunOverview_factIcon"
            aria-hidden="true"
          />
          {{ t(l.attemptValue, { attempt: run.runAttempt, count: run.runAttempt }) }}
        </dd>
      </dl>
    </template>
  </section>
</template>

<style lang="scss" module="css">
// The bars' column, after the jobs' names; the times follow the bars.
$name-width: 160px;
$time-width: 64px;

.workflowRunOverview {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  max-width: 880px;
  padding: $spacing-20 $spacing-24 $spacing-24 $spacing-32;
}

.workflowRunOverview_head {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  margin-bottom: $spacing-16;
}

.workflowRunOverview_headline {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  margin: 0;
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.workflowRunOverview_mark {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-fg-3;
}

.workflowRunOverview_mark_failed {
  color: $color-red;
}

.workflowRunOverview_mark_passed {
  color: $color-green;
}

.workflowRunOverview_mark_running {
  color: $color-amber;
}

.workflowRunOverview_sentence {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.workflowRunOverview_title {
  margin: 0;
  font-size: $font-size-sm;
  font-weight: $font-weight-normal;
  color: $color-fg-2;
}

.workflowRunOverview_timeline {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: 0;
  margin: 0 0 $spacing-24;
  list-style: none;
}

.workflowRunOverview_bar {
  display: grid;
  grid-template-columns: $name-width minmax(0, 1fr) $time-width;
  gap: $spacing-12;
  align-items: center;
}

.workflowRunOverview_barName {
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunOverview_track {
  position: relative;
  height: 6px;
  background: $color-bg-3;
  border-radius: $radius-sm;
}

.workflowRunOverview_fill {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 2px;
  background: $color-fg-3;
  border-radius: $radius-sm;
}

.workflowRunOverview_fill_passed {
  background: $color-green;
}

.workflowRunOverview_fill_failed {
  background: $color-red;
}

.workflowRunOverview_fill_running {
  background: $color-amber;
}

.workflowRunOverview_barTime {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  text-align: right;
  white-space: nowrap;
}

.workflowRunOverview_facts {
  display: grid;
  grid-template-columns: $name-width minmax(0, 1fr);
  gap: $spacing-10 $spacing-12;
  margin: 0;
  font-size: $font-size-sm;
}

.workflowRunOverview_term {
  color: $color-fg-dim;
}

.workflowRunOverview_value {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-8;
  align-items: center;
  min-width: 0;
  margin: 0;
  color: $color-fg;
}

.workflowRunOverview_commit {
  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
}

.workflowRunOverview_factIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-dim;
}

.workflowRunOverview_sha {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
}

.workflowRunOverview_commitTitle {
  flex-basis: 100%;
  color: $color-fg-2;
}
</style>
