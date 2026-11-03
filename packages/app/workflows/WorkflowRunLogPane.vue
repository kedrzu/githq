<!-- A run's log pane (actions W4a): the job, how far its log is and the toggles of how it shows on top, whatever the log's state, the job's log (`WorkflowJobLog`) — or what stands in for it — and the key hints along the bottom, those that lead somewhere: none past retention, none for errors with no error marker, a search's own while one is open (W4b, W4c). In its place: placeholder lines while it is read (W4e); the job still running, its log landing here by itself once it finishes (W4j); past GitHub's retention, with the failed step named (W4g); a read that failed, with GitHub's real answer and Enter to try again (W4i); a log the desktop app refused, which says so and can be tried again, or one too big for it, which GitHub is the way to and nothing tries again; a job that never ran, skipped or cancelled before it started, with its conclusion. A failure stays in here: the jobs and every other job's log keep working. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleSlash, FileX, Ghost, Github, Hourglass, RotateCw, ShieldX, Unplug } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import Button from '@/components/Button.vue';
import Kbd from '@/components/Kbd.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { formatDuration } from '@/utils/formatDuration.js';
import { getElapsedUnit } from '@/utils/getElapsedUnit.js';

import type { WorkflowLogPane } from './buildWorkflowRun.js';
import type { LogMatches } from './utils/findLogMatches.js';
import { getJobMark } from './utils/getJobMark.js';
import type { LogLineAddress } from './utils/logLineHash.js';
import WorkflowEmptyState from './WorkflowEmptyState.vue';
import WorkflowJobLog from './WorkflowJobLog.vue';
import WorkflowLogToolbar from './WorkflowLogToolbar.vue';
import * as l from './WorkflowRunLogPane.loc.js';

const props = defineProps<{
  pane: WorkflowLogPane;
  /** `owner/name`. */
  nameWithOwner: string;
  runId: number;
  /** The log line the address names; `null` with none. */
  lineAddress: LogLineAddress | null;
  /** When the run was created (ISO); `null` while it is not known. */
  runCreatedAt: string | null;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

/** What is searched for in the log; `null` with the search closed. It outlives one job's log, as the pane does. */
const query = defineModel<string | null>('query', { default: null });
/** What the search found in the log showing. */
const matches = defineModel<LogMatches | null>('matches', { default: null });

const emit = defineEmits<{
  /** The way to GitHub was pressed. */
  openOnGitHub: [];
  /** "Try again" was pressed. */
  retry: [];
}>();

/** A hint along the bottom: the keys, and what they do. */
interface KeyHint {
  readonly keys: readonly string[];
  readonly label: string;
}

/** What stands in for the log. */
interface LogMessage {
  readonly icon: LucideIcon;
  readonly tone: 'amber' | 'neutral';
  readonly title: string;
  readonly text: string;
  readonly detail: string;
  readonly gitHubLabel: string;
}

/** What GitHub keeps logs for by default (actions D3); a repository can set otherwise, and githq can't see it. */
const RETENTION_DAYS = 90;
const PLACEHOLDER_LINES = [62, 48, 71, 35, 55, 80, 44, 66, 30, 58, 74, 40];
const NUMBER_FORMAT = new Intl.NumberFormat(APP_LANGUAGE);

const t = useTranslate();

/** Another job's log shows in full, its matches yet to be looked at. */
const onlyMatches = ref(false);
/** The search's field has the focus: its letters are typed, so Enter stands for N. */
const searchFieldFocused = ref(false);

const size = computed(() => {
  const { pane } = props;
  switch (pane.kind) {
    case 'loading':
      return t(l.reading);
    case 'ready':
      return t(l.logSize, {
        count: pane.log.lines.length,
        shown: NUMBER_FORMAT.format(pane.log.lines.length),
        kilobytes: NUMBER_FORMAT.format(Math.round(pane.log.characters / 1000)),
      });
    case 'running':
      return t(l.stillRunning);
    case 'gone':
      return t(l.logDeleted);
    case 'failed':
    case 'tooLarge':
    case 'refused':
      return t(l.notLoaded);
    case 'neverRan':
      return getConclusion(pane);
    default:
      return assertNever(pane);
  }
});
const message = computed((): LogMessage | null => {
  const { pane } = props;
  switch (pane.kind) {
    case 'loading':
    case 'ready':
      return null;
    case 'running':
      return getRunningMessage(pane);
    case 'gone':
      return getGoneMessage(pane);
    case 'failed':
      return getFailedMessage(pane);
    case 'tooLarge':
      return {
        icon: FileX,
        tone: 'amber',
        title: t(l.tooLargeTitle, { job: pane.job.name }),
        text: t(l.tooLargeText),
        detail: t(l.tooLargeDetail, { id: pane.job.id }),
        gitHubLabel: t(l.openOnGitHub),
      };
    case 'refused':
      return {
        icon: ShieldX,
        tone: 'amber',
        title: t(l.failedTitle, { job: pane.job.name }),
        text: t(l.refusedText),
        detail: t(l.refusedDetail, { id: pane.job.id }),
        gitHubLabel: t(l.openOnGitHub),
      };
    case 'neverRan':
      return {
        icon: CircleSlash,
        tone: 'neutral',
        title: t(l.neverRanTitle, { job: pane.job.name }),
        text: t(l.neverRanText),
        detail: t(l.neverRanDetail, { conclusion: getConclusion(pane) }),
        gitHubLabel: t(l.openOnGitHub),
      };
    default:
      return assertNever(pane);
  }
});

const canRetry = computed(() => props.pane.kind === 'failed' || props.pane.kind === 'refused');
const hints = computed((): readonly KeyHint[] => {
  const { pane } = props;
  const job = { keys: ['Alt+J', 'Alt+K'], label: t(l.job) };
  const gitHub = { keys: ['O'], label: t(l.gitHub) };
  if (pane.kind !== 'ready') {
    return canRetry.value ? [{ keys: ['Enter'], label: t(l.tryAgain) }, job, gitHub] : [job, gitHub];
  }

  const step = { keys: ['Shift+J', 'Shift+K'], label: t(l.step) };
  const errors = pane.log.errors.length > 0 ? [{ keys: ['E'], label: t(l.error) }] : [];
  if (query.value === null) {
    return [
      { keys: ['J', 'K'], label: t(l.line) },
      step,
      job,
      ...errors,
      { keys: ['/'], label: t(l.search) },
      { keys: ['Space'], label: t(l.fold) },
      gitHub,
    ];
  }

  if (onlyMatches.value && (matches.value?.lines.length ?? 0) > 0) {
    return [
      { keys: ['J', 'K'], label: t(l.match) },
      { keys: ['Enter'], label: t(l.showInFullLog) },
      { keys: ['Space'], label: t(l.openGap) },
      job,
      gitHub,
    ];
  }

  return [
    { keys: [searchFieldFocused.value ? 'Enter' : 'N'], label: t(l.nextMatch) },
    { keys: [searchFieldFocused.value ? 'Shift+Enter' : 'Shift+N'], label: t(l.previousMatch) },
    ...errors,
    step,
    job,
    { keys: ['Y'], label: t(l.copyLineLink) },
    gitHub,
  ];
});

// Before the render that brings the other job's log.
watch(
  () => props.pane.job?.id,
  () => {
    onlyMatches.value = false;
  },
);

function getConclusion({ job }: Extract<WorkflowLogPane, { kind: 'neverRan' }>) {
  return job.conclusion ?? job.status;
}

function getRunningMessage(pane: Extract<WorkflowLogPane, { kind: 'running' }>): LogMessage {
  const { job } = pane;
  const running = getJobMark(job) === 'running';
  return {
    icon: Hourglass,
    tone: 'amber',
    title: running ? t(l.runningTitle, { job: job.name }) : t(l.waitingTitle, { job: job.name }),
    text: t(l.runningText),
    detail:
      running && job.startedAt !== null
        ? t(l.runningDetail, { status: job.status, duration: formatDuration(props.now - Date.parse(job.startedAt)) })
        : t(l.waitingDetail, { status: job.status }),
    gitHubLabel: t(l.watchOnGitHub),
  };
}

function getGoneMessage(pane: Extract<WorkflowLogPane, { kind: 'gone' }>): LogMessage {
  const days =
    props.runCreatedAt === null ? 0 : (getElapsedUnit(props.now - Date.parse(props.runCreatedAt), ['day'])?.count ?? 0);
  const failedStep = pane.job.steps.find(step => getJobMark(step) === 'failed');
  const retention = days >= RETENTION_DAYS ? t(l.goneOld, { days }) : t(l.goneYoung);
  return {
    icon: Ghost,
    tone: 'neutral',
    title: t(l.goneTitle),
    text: failedStep ? `${t(l.goneFailedAt, { step: failedStep.name })} ${retention}` : retention,
    detail: t(l.goneDetail, { days }),
    gitHubLabel: t(l.openOnGitHub),
  };
}

function getFailedMessage(pane: Extract<WorkflowLogPane, { kind: 'failed' }>): LogMessage {
  const { job, httpStatus } = pane;
  return {
    icon: Unplug,
    tone: 'amber',
    title: t(l.failedTitle, { job: job.name }),
    text: httpStatus === null ? t(l.failedNoAnswerText) : t(l.failedText, { status: httpStatus }),
    detail:
      httpStatus === null
        ? t(l.failedNoAnswerDetail, { id: job.id })
        : t(l.failedDetail, { id: job.id, status: httpStatus }),
    gitHubLabel: t(l.openOnGitHub),
  };
}
</script>

<template>
  <section
    :class="css.workflowRunLogPane"
    :aria-label="pane.job?.name"
  >
    <WorkflowJobLog
      v-if="pane.kind === 'ready'"
      :key="pane.job.id"
      v-model:query="query"
      v-model:only-matches="onlyMatches"
      :job="pane.job"
      :log="pane.log"
      :name-with-owner="nameWithOwner"
      :run-id="runId"
      :size="size"
      :address="lineAddress"
      @matches="matches = $event"
      @search-field-focus="searchFieldFocused = $event"
    />
    <WorkflowLogToolbar
      v-else
      :job="pane.job?.name ?? null"
      :size="size"
    />
    <div
      v-if="pane.kind === 'loading'"
      :class="css.workflowRunLogPane_placeholders"
      aria-hidden="true"
      tid="workflow-log-placeholder"
    >
      <span
        v-for="(width, index) in PLACEHOLDER_LINES"
        :key="index"
        :class="css.workflowRunLogPane_placeholder"
        :style="{ width: `${width}%` }"
      />
    </div>
    <div
      v-else-if="message"
      :class="css.workflowRunLogPane_message"
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
            v-if="canRetry"
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
    <div
      v-if="pane.kind !== 'gone'"
      :class="css.workflowRunLogPane_keys"
      aria-hidden="true"
      tid="workflow-log-keys"
    >
      <span
        v-for="hint in hints"
        :key="hint.label"
        :class="css.workflowRunLogPane_hint"
      >
        <Kbd
          v-for="key in hint.keys"
          :key="key"
          :keys="key"
        />
        {{ hint.label }}
      </span>
      <span :class="css.workflowRunLogPane_spacer" />
      <span :class="css.workflowRunLogPane_hint">
        <Kbd keys="?" />
        {{ t(l.allKeys) }}
      </span>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.workflowRunLogPane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.workflowRunLogPane_placeholders {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-8;
  min-height: 0;
  padding: $spacing-14;
  overflow: hidden;
}

.workflowRunLogPane_placeholder {
  @include placeholder-bar;

  flex: none;
}

.workflowRunLogPane_message {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: $spacing-16;
  overflow: auto;
}

.workflowRunLogPane_keys {
  display: flex;
  flex: none;
  gap: $spacing-12;
  align-items: center;
  height: 30px;
  padding: 0 $spacing-14;
  background: $color-bg-2;
  border-top: 1px solid $color-border;
}

.workflowRunLogPane_hint {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.workflowRunLogPane_spacer {
  flex: 1;
}
</style>
