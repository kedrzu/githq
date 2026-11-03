<!-- A workflow's run on a page of its own (actions W4a): the toolbar — the repository, the workflow and the run's number, GitHub (`O`) and back (`Esc`) —, what the run is (`WorkflowRunSummary`), then its jobs (`WorkflowRunJobs`) beside the selected job's log (`WorkflowRunLogPane`). What is known shows at once; the jobs, then the log, load in place, and nothing else waits for them (W4e). With no columns to show the page says why: an invalid workflow file (W4f), a run GitHub won't show, a read that failed, or a run with no jobs. Keys while it is shown, never from a field — it takes the focus as it opens: ⌥J/⌥K move between the jobs, Enter tries a failed read again, O opens the run on GitHub, also in ⌘K. No key or command for re-running yet. -->
<script lang="ts" setup>
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleDot, FileX, Ghost, Github, Hourglass, PackageOpen, RotateCw, Unplug, X } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed, onMounted, useTemplateRef } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import { getGitHubUrl, getWorkflowRunPath } from '@/tracking/trackingRoutes.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';

import type { WorkflowLogPane, WorkflowRunModel } from './buildWorkflowRun.js';
import { describeWorkflowRun } from './utils/describeWorkflowRun.js';
import WorkflowEmptyState from './WorkflowEmptyState.vue';
import WorkflowRunJobs from './WorkflowRunJobs.vue';
import WorkflowRunLogPane from './WorkflowRunLogPane.vue';
import WorkflowRunSummary from './WorkflowRunSummary.vue';
import * as l from './WorkflowRunView.loc.js';
import type { WorkflowRowRef } from './WorkflowTypes.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  runId: number;
  model: WorkflowRunModel;
  /** The selected job's log, or what stands in for it. */
  logPane: WorkflowLogPane;
  /** The ref the run is on; `null` when GitHub names none. */
  gitRef: WorkflowRowRef | null;
  /** Where the run's workflow file is, as last read; `null` when not known. */
  workflowPath: string | null;
  /** The run's workflow is broken as things stand. */
  stillBroken: boolean;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** ⌥J/⌥K or a click: the caller selects the job. */
  selectJob: [job: GitHubWorkflowJob];
  /** Enter or "Try again": the caller reads again what failed. */
  retry: [];
  /** O or a way to GitHub: the caller opens the run there. */
  openOnGitHub: [];
  /** Esc or the toolbar's close. */
  close: [];
}>();

/** What stands in for the columns. */
interface RunMessage {
  readonly icon: LucideIcon;
  readonly tone: 'amber' | 'neutral' | 'red';
  readonly title: string;
  readonly text: string;
  readonly detail: string | null;
  readonly gitHubLabel: string;
  readonly retry: boolean;
}

const t = useTranslate();
const root = useTemplateRef('root');

const title = computed(() => {
  const { run } = props.model;
  if (!run) {
    return t(l.unknownTitle, { id: props.runId });
  }

  return run.workflowName === null
    ? t(l.runTitle, { number: run.runNumber })
    : t(l.title, { workflow: run.workflowName, number: run.runNumber });
});
const mark = computed(() => (props.model.run ? describeWorkflowRun(props.model.run, props.now).mark : 'none'));
const gitHubUrl = computed(() => getGitHubUrl(getWorkflowRunPath(props.nameWithOwner, props.runId)));
const showsColumns = computed(() => props.model.body.kind === 'jobs' || props.model.body.kind === 'loading');
const message = computed((): RunMessage | null => {
  const { body } = props.model;
  switch (body.kind) {
    case 'loading':
    case 'jobs':
      return null;
    case 'gone':
      return {
        icon: Ghost,
        tone: 'neutral',
        title: t(l.goneTitle),
        text: t(l.goneText, { id: props.runId, name: props.nameWithOwner }),
        detail: null,
        gitHubLabel: t(l.openOnGitHub),
        retry: false,
      };
    case 'runFailed':
      return getFailedMessage(t(l.runFailedTitle), `runs/${props.runId}`, body.httpStatus);
    case 'jobsFailed':
      return getFailedMessage(t(l.jobsFailedTitle), `runs/${props.runId}/jobs`, body.httpStatus);
    case 'invalidFile':
      return getInvalidFileMessage();
    case 'noJobs':
      return body.going
        ? {
            icon: Hourglass,
            tone: 'amber',
            title: t(l.noJobsWaitingTitle),
            text: t(l.noJobsWaitingText),
            detail: null,
            gitHubLabel: t(l.openOnGitHub),
            retry: false,
          }
        : {
            icon: PackageOpen,
            tone: 'neutral',
            title: t(l.noJobsTitle),
            text: t(l.noJobsText),
            detail: null,
            gitHubLabel: t(l.openOnGitHub),
            retry: false,
          };
    default:
      return assertNever(body);
  }
});
const canRetry = computed(() => props.logPane.kind === 'failed' || message.value?.retry === true);
const selectedIndex = computed(() => {
  const { jobs, selectedJob } = props.model;
  return selectedJob ? jobs.indexOf(selectedJob) : -1;
});

useCommands(() => [
  {
    id: 'workflowRun.nextJob',
    title: t(l.nextJob),
    section: 'view',
    key: 'Alt+J',
    menu: false,
    when: () => showsColumns.value && selectedIndex.value < props.model.jobs.length - 1,
    run: () => moveJob(1),
  },
  {
    id: 'workflowRun.previousJob',
    title: t(l.previousJob),
    section: 'view',
    key: 'Alt+K',
    menu: false,
    when: () => showsColumns.value && selectedIndex.value > 0,
    run: () => moveJob(-1),
  },
  // Not from a button or a link, which do what they say.
  {
    id: 'workflowRun.retry',
    title: t(l.tryAgain),
    section: 'view',
    key: 'Enter',
    menu: false,
    when: () => canRetry.value && !isActivatableTarget(document.activeElement),
    run: () => emit('retry'),
  },
  {
    id: 'workflowRun.openOnGitHub',
    title: t(l.openOnGitHub),
    section: 'view',
    key: 'O',
    icon: Github,
    run: () => emit('openOnGitHub'),
  },
  {
    id: 'workflowRun.back',
    title: t(l.back),
    section: 'view',
    key: 'Escape',
    menu: false,
    run: () => emit('close'),
  },
]);

// Arrived from a row or a tick, the keys are the page's: Enter no longer presses what was clicked.
onMounted(() => root.value?.focus({ preventScroll: true }));

function selectJob(job: GitHubWorkflowJob) {
  // A job clicked gives the keys back: Enter tries a failed log again rather than pressing the job.
  root.value?.focus({ preventScroll: true });
  emit('selectJob', job);
}

function moveJob(by: number) {
  const job = props.model.jobs[selectedIndex.value + by];
  if (job) {
    emit('selectJob', job);
  }
}

function getFailedMessage(heading: string, path: string, httpStatus: number | null): RunMessage {
  return {
    icon: Unplug,
    tone: 'amber',
    title: heading,
    text: httpStatus === null ? t(l.failedNoAnswerText) : t(l.failedText, { status: httpStatus }),
    detail: httpStatus === null ? t(l.failedNoAnswerDetail, { path }) : t(l.failedDetail, { path, status: httpStatus }),
    gitHubLabel: t(l.openOnGitHub),
    retry: true,
  };
}

function getInvalidFileMessage(): RunMessage {
  const { workflowPath } = props;
  return {
    icon: FileX,
    tone: 'red',
    title: t(l.invalidTitle),
    text: t(l.invalidText, { file: workflowPath ?? t(l.invalidFile) }),
    detail:
      workflowPath === null
        ? t(l.invalidDetailNoFile)
        : t(l.invalidDetail, { file: workflowPath.split('/').at(-1) ?? workflowPath }),
    gitHubLabel: t(l.seeError),
    retry: false,
  };
}
</script>

<template>
  <article
    ref="root"
    :class="css.workflowRunView"
    :aria-label="title"
    tabindex="-1"
  >
    <header
      :class="css.workflowRunView_toolbar"
      v-bind="WINDOW_DRAG_REGION"
    >
      <CircleDot
        :class="[css.workflowRunView_mark, css[`workflowRunView_mark_${mark}`]]"
        aria-hidden="true"
      />
      <span :class="css.workflowRunView_repository">{{ nameWithOwner }}</span>
      <h1 :class="css.workflowRunView_title">{{ title }}</h1>
      <span :class="css.workflowRunView_spacer" />
      <IconButton
        :icon="Github"
        :label="t(l.openOnGitHub)"
        kbd="O"
        :link="gitHubUrl"
        target="_blank"
        rel="noopener noreferrer"
        aria-keyshortcuts="O"
      />
      <IconButton
        :icon="X"
        :label="t(l.back)"
        kbd="Escape"
        aria-keyshortcuts="Escape"
        @click="emit('close')"
      />
    </header>
    <WorkflowRunSummary
      :run="model.run"
      :git-ref="gitRef"
      :still-broken="stillBroken"
      :now="now"
    />
    <div
      v-if="showsColumns"
      :class="css.workflowRunView_columns"
    >
      <WorkflowRunJobs
        :jobs="model.jobs"
        :counts="model.counts"
        :selected-id="model.selectedJob?.id ?? null"
        :loading="model.body.kind === 'loading'"
        :now="now"
        @select="selectJob"
      />
      <WorkflowRunLogPane
        :pane="logPane"
        :run-created-at="model.run?.createdAt ?? null"
        :now="now"
        @retry="emit('retry')"
        @open-on-git-hub="emit('openOnGitHub')"
      />
    </div>
    <div
      v-else-if="message"
      :class="css.workflowRunView_message"
    >
      <WorkflowEmptyState
        :icon="message.icon"
        :tone="message.tone"
        :title="message.title"
        :text="message.text"
        :detail="message.detail"
      >
        <template #actions>
          <Button
            v-if="message.retry"
            variant="secondary"
            size="sm"
            :icon="RotateCw"
            kbd="Enter"
            aria-keyshortcuts="Enter"
            @click="emit('retry')"
          >
            {{ t(l.tryAgain) }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :icon="Github"
            kbd="O"
            aria-keyshortcuts="O"
            @click="emit('openOnGitHub')"
          >
            {{ message.gitHubLabel }}
          </Button>
        </template>
      </WorkflowEmptyState>
    </div>
  </article>
</template>

<style lang="scss" module="css">
.workflowRunView {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  outline: none;
}

.workflowRunView_toolbar {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: $list-header-height;
  padding: 0 14px 0 $spacing-16;
  font-size: $font-size-sm;
  border-bottom: 1px solid $color-border;
}

.workflowRunView_mark {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.workflowRunView_mark_failed {
  color: $color-red;
}

.workflowRunView_mark_passed {
  color: $color-green;
}

.workflowRunView_mark_running {
  color: $color-amber;
}

.workflowRunView_repository {
  flex: none;
  color: $color-fg-2;
}

.workflowRunView_title {
  min-width: 0;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: inherit;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowRunView_spacer {
  flex: 1;
}

.workflowRunView_columns {
  display: flex;
  flex: 1;
  min-height: 0;
}

.workflowRunView_message {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: $spacing-16;
  overflow: auto;
}
</style>
