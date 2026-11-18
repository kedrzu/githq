<!-- A workflow's run (actions W4a, W34), the same view on its page or in the panel beside a repository's Workflows section: the toolbar across it — the repository, the workflow (a link to its page, when known) and the run's number, the other arrangement ("Open full screen" from the panel: the button, `⇧Enter`, ⌘K; "Back to the panel" from the page while the panel fits: the button, ⌘K), GitHub (`O`) and back (`Esc`) —, then, on the page in a centred box of the item page's width (D9, the same setting, its edges dragged), in the panel across its whole width, what the run is (`WorkflowRunSummary`), then its jobs (`WorkflowRunJobs`) beside the selected job's log (`WorkflowRunLogPane`) or, for a run opened with nothing failed, the run's overview (`WorkflowRunOverview`) with a key bar under it; the edge between them dragged from 200 to 480px, kept on this device (`ColumnSplit`). What is known shows at once; the jobs, then the log, load in place, and nothing else waits for them (W4e). With no columns to show the page says why: an invalid workflow file (W4f), a run GitHub won't show, a read that failed, or a run with no jobs. Keys while it is shown, never from a field — it takes the focus as it opens: ⌥J/⌥K move between the jobs (at the overview, the cursor on them), Enter tries a failed read again or, at the overview, opens the cursor's job's log, O opens the selected job on GitHub, the run with none selected, also in ⌘K. The log's own keys are `WorkflowJobLog`'s, Esc among them while a search is open; the search belongs to this page, not to one job's log: selecting another job keeps the query and searches that job, and its matches count in the jobs' column. Re-running the failed jobs is a command of ⌘K only, first in it, with no key anywhere (D10), and goes with no question asked (W4k); so are, where the user may change the repository's runs, re-running all the jobs of a run that finished or the job under the cursor, and cancelling a run that goes, offered dimmed once it finished (W40). ⌘K also copies the run's link and opens its workflow. -->
<script lang="ts" setup>
import { PAGE_WIDTH as ITEM_PAGE_WIDTH } from '@/item/ItemView.vue';
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import {
  ChevronRight,
  CircleDot,
  FileX,
  Ghost,
  Github,
  Hourglass,
  PackageOpen,
  RotateCw,
  Unplug,
  X,
} from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import * as definitions from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import ColumnSplit from '@/components/ColumnSplit.vue';
import EmptyState from '@/components/EmptyState.vue';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import { useMaxWidth } from '@/components/useMaxWidth.js';
import WidthHandle from '@/components/WidthHandle.vue';
import type { ItemArrangement } from '@/item/itemRoutes.js';
import { useOtherArrangement } from '@/item/useItemArrangement.js';
import { useReadingCursor } from '@/reading/useReadingCursor.js';
import type { OtherArrangement } from '@/item/useItemArrangement.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import { getGitHubUrl, getWorkflowRunPath } from '@/tracking/trackingRoutes.js';
import type { MaxWidth } from '@/settings/sync/SettingsDocument.js';

import type { WorkflowLogPane, WorkflowRunModel } from './buildWorkflowRun.js';
import { describeWorkflowRun } from './utils/describeWorkflowRun.js';
import type { LogMatches } from './utils/findLogMatches.js';
import type { LogLineAddress } from './utils/logLineHash.js';
import WorkflowRunJobs from './WorkflowRunJobs.vue';
import WorkflowRunLogPane from './WorkflowRunLogPane.vue';
import WorkflowRunOverview from './WorkflowRunOverview.vue';
import WorkflowRunSummary from './WorkflowRunSummary.vue';
import * as l from './WorkflowRunView.loc.js';
import type { WorkflowRowRef } from './WorkflowTypes.js';

const props = defineProps<{
  /** On its page, in a centred box whose edges are dragged, or in the panel, filling it. */
  arrangement: ItemArrangement;
  /** `owner/name`. */
  nameWithOwner: string;
  runId: number;
  model: WorkflowRunModel;
  /** The selected job's log, or what stands in for it. */
  logPane: WorkflowLogPane;
  /** The log line the address names (`…/job/1#step:2:3`); `null` with none. */
  lineAddress: LogLineAddress | null;
  /** The ref the run is on; `null` when GitHub names none. */
  gitRef: WorkflowRowRef | null;
  /** Where the run's workflow file is, as last read; `null` when not known. */
  workflowPath: string | null;
  /** The route path of the run's workflow's page, which the toolbar links to; `null` while the workflow isn't known. */
  workflowPage?: string | null;
  /** Esc goes back to the run's workflow, which the key bar names; otherwise it says "Back". */
  backToWorkflow?: boolean;
  /**
   * The box's maximum width the user chose, shared with the item page (`itemPageWidth`); none for the default. Only on
   * the page: in the panel the box fills it.
   */
  pageWidth?: MaxWidth | null;
  /** The run's workflow is broken as things stand. */
  stillBroken: boolean;
  /** "Re-run failed jobs" is offered (`canRerunFailedJobs`). */
  canRerun?: boolean;
  /**
   * The user may re-run and cancel the repository's runs, as they may re-run the failed jobs (`canChangeRuns`): "Re-run
   * all jobs", "Re-run job" and "Cancel run" are offered.
   */
  canChangeRuns?: boolean;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** ⌥J/⌥K, a click, or Enter at the overview: the caller selects the job, opening its log. */
  selectJob: [job: GitHubWorkflowJob];
  /** Enter or "Try again": the caller reads again what failed. */
  retry: [];
  /** O or a way to GitHub: the caller opens the selected job there, the run with none selected. */
  openOnGitHub: [url: string];
  /** Esc or the toolbar's close. */
  close: [];
  /** "Re-run failed jobs" in ⌘K. */
  rerun: [];
  /** "Re-run all jobs" in ⌘K. */
  rerunAll: [];
  /** "Re-run job" in ⌘K: the job under the cursor. */
  rerunJob: [job: GitHubWorkflowJob];
  /** "Cancel run" in ⌘K. */
  cancel: [];
  /** "Open workflow" in ⌘K: the caller goes to the run's workflow's page. */
  openWorkflow: [];
  /** "Open full screen" (the header's button, `⇧Enter`, ⌘K) or "Back to the panel" (the button, ⌘K). */
  arrange: [arrangement: ItemArrangement];
  /** The user dragged the box's edges to this maximum: the caller keeps it. */
  resizePage: [width: MaxWidth];
}>();

/** What stands in for the columns. */
interface RunMessage {
  readonly icon: LucideIcon;
  readonly tone: 'broken' | 'muted' | 'warning';
  readonly title: string;
  readonly text: string;
  readonly detail?: string;
  readonly gitHubLabel: string;
  readonly retry: boolean;
}

/** Where the run's commands are offered. */
const RUN_PLACE = { place: 'workflowRun', section: 'view' } as const;
/** The page's scrolling keys, in no menu. */
const SCROLL = { place: 'workflowRun', section: 'view', menu: false, when: () => scrolling.value } as const;
/** The jobs' column: dragged from 200 to 480px. */
const JOBS_WIDTH = { key: 'workflowRunJobs', default: 268, min: 200, max: 480 };
/**
 * The box the summary, the jobs and the log stand in: the item page's (D9), whose width setting it shares, by default
 * as wide as `PAGE_WIDTH` in `ItemView`; at least the jobs at their narrowest beside the pane's minimum.
 */
const PAGE_WIDTH = { default: ITEM_PAGE_WIDTH.default, min: 600 };

const t = useTranslate();
const otherArrangement = useOtherArrangement(() => props.arrangement);
const root = useTemplateRef('root');
const roomRef = useTemplateRef('room');
const overviewRef = useTemplateRef('overview');
const phone = useService(PhoneLayout);
/** The width there is for the box. */
const room = ref(0);
const box = useMaxWidth({
  saved: () => props.pageWidth ?? null,
  save: width => emit('resizePage', width),
  default: PAGE_WIDTH.default,
  min: PAGE_WIDTH.min,
  room,
});
/** At the overview, the job ⌥J/⌥K are on and Enter opens; `null` for the first. */
const cursorId = ref<number | null>(null);
/** What the log is searched for; `null` with the search closed. */
const logQuery = ref<string | null>(null);
const logMatches = shallowRef<LogMatches | null>(null);

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
const gitHubUrl = computed(() =>
  getGitHubUrl(
    getWorkflowRunPath({
      nameWithOwner: props.nameWithOwner,
      runId: props.runId,
      jobId: props.model.selectedJob?.id,
    }),
  ),
);
const runUrl = computed(() =>
  getGitHubUrl(getWorkflowRunPath({ nameWithOwner: props.nameWithOwner, runId: props.runId })),
);
const page = computed(() => props.arrangement === 'page');
/** On its page, not on a phone, with the overview shown: ↓ ↑ PageDown PageUp scroll it. A job's log has its own keys. */
const scrolling = computed(() => page.value && !phone.active && props.model.body.kind === 'overview');
const scrollKeys = useReadingCursor({
  scroller: overviewRef,
  cursor: shallowRef(null),
  stops: false,
  isActive: scrolling,
});
const finished = computed(() => props.model.run?.status === 'completed');
const atOverview = computed(() => props.model.body.kind === 'overview');
const showsColumns = computed(() => {
  const { kind } = props.model.body;
  return kind === 'loading' || kind === 'jobs' || kind === 'overview';
});
const cursorJob = computed(() => {
  const { jobs } = props.model;
  return jobs.find(job => job.id === cursorId.value) ?? jobs[0] ?? null;
});
/** The job the column marks: the cursor at the overview, else the one whose log shows. */
const markedJob = computed(() => (atOverview.value ? cursorJob.value : props.model.selectedJob));
const message = computed((): RunMessage | null => {
  const { body } = props.model;
  switch (body.kind) {
    case 'loading':
    case 'jobs':
    case 'overview':
      return null;
    case 'gone':
      return {
        icon: Ghost,
        tone: 'muted',
        title: t(l.goneTitle),
        text: t(l.goneText, { id: props.runId, name: props.nameWithOwner }),
        gitHubLabel: t(definitions.openOnGitHub.title),
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
            tone: 'warning',
            title: t(l.noJobsWaitingTitle),
            text: t(l.noJobsWaitingText),
            gitHubLabel: t(definitions.openOnGitHub.title),
            retry: false,
          }
        : {
            icon: PackageOpen,
            tone: 'muted',
            title: t(l.noJobsTitle),
            text: t(l.noJobsText),
            gitHubLabel: t(definitions.openOnGitHub.title),
            retry: false,
          };
    default:
      return assertNever(body);
  }
});
const canRetry = computed(
  () => props.logPane.kind === 'failed' || props.logPane.kind === 'refused' || message.value?.retry === true,
);
const selectedIndex = computed(() => {
  const job = markedJob.value;
  return job ? props.model.jobs.indexOf(job) : -1;
});
const hints = computed(() => [
  { id: 'job', keys: [keyOf(definitions.nextJob), keyOf(definitions.previousJob)], label: t(l.hintJob) },
  { id: 'open', keys: [keyOf(definitions.openLog)], label: t(l.hintOpenLog) },
  {
    id: 'back',
    keys: [keyOf(definitions.back)],
    label:
      props.backToWorkflow && props.model.run?.workflowName
        ? t(l.backTo, { workflow: props.model.run.workflowName })
        : t(l.back),
  },
  { id: 'gitHub', keys: [keyOf(definitions.openOnGitHub)], label: t(l.hintGitHub) },
]);

useCommands(() => [
  // In the item's section, as every opened item's: it wins over the list's own ⇧Enter beside the panel.
  ...(otherArrangement.value ? [getArrangeCommand(otherArrangement.value)] : []),
  // No key, here or anywhere: it starts something in the repository, so it is never one stray keystroke away (D10).
  bindCommand(
    definitions.rerunFailedJobs,
    {
      ...RUN_PLACE,
      detail: t(l.rerunDetail, {
        count: props.model.rerunnableJobs.length,
        jobs: props.model.rerunnableJobs.map(job => job.name).join(', '),
      }),
      when: () => props.canRerun,
      run: () => emit('rerun'),
    },
    t,
  ),
  // None of these have a key either (D10).
  bindCommand(
    definitions.rerunAllJobs,
    {
      ...RUN_PLACE,
      detail: props.model.jobs.length > 0 ? t(l.jobCount, { count: props.model.jobs.length }) : undefined,
      when: () => props.canChangeRuns && finished.value,
      run: () => emit('rerunAll'),
    },
    t,
  ),
  bindCommand(
    definitions.rerunJob,
    {
      ...RUN_PLACE,
      title: t(l.rerunJob, { job: markedJob.value?.name ?? '' }),
      detail: t(l.rerunJobDetail),
      when: () => props.canChangeRuns && finished.value && markedJob.value?.status === 'completed',
      run: () => {
        if (markedJob.value) {
          emit('rerunJob', markedJob.value);
        }
      },
    },
    t,
  ),
  bindCommand(
    definitions.cancelRun,
    {
      ...RUN_PLACE,
      unavailable: finished.value ? t(l.cancelFinished) : undefined,
      when: () => props.canChangeRuns && props.model.run !== null,
      run: () => emit('cancel'),
    },
    t,
  ),
  bindCommand(
    definitions.nextJob,
    {
      ...RUN_PLACE,
      menu: false,
      when: () => showsColumns.value && selectedIndex.value < props.model.jobs.length - 1,
      run: () => moveJob(1),
    },
    t,
  ),
  bindCommand(
    definitions.previousJob,
    { ...RUN_PLACE, menu: false, when: () => showsColumns.value && selectedIndex.value > 0, run: () => moveJob(-1) },
    t,
  ),
  // The log's own Enter (`jobLog`) goes first; it is not there at the overview, nor in place of a log that failed.
  bindCommand(
    definitions.openLog,
    { ...RUN_PLACE, menu: false, when: () => atOverview.value && cursorJob.value !== null, run: openCursorJob },
    t,
  ),
  bindCommand(
    definitions.tryAgain,
    { ...RUN_PLACE, menu: false, when: () => canRetry.value, run: () => emit('retry') },
    t,
  ),
  bindCommand(definitions.openOnGitHub, { ...RUN_PLACE, run: () => emit('openOnGitHub', gitHubUrl.value) }, t),
  bindCommand(
    definitions.copyLink,
    { ...RUN_PLACE, title: t(l.copyLink), run: () => void navigator.clipboard.writeText(runUrl.value) },
    t,
  ),
  bindCommand(
    definitions.openWorkflow,
    {
      ...RUN_PLACE,
      detail: props.model.run?.workflowName ?? undefined,
      when: () => Boolean(props.workflowPage),
      run: () => emit('openWorkflow'),
    },
    t,
  ),
  // After the log's search closes by Escape (`jobLog` keeps the keyboard over the run).
  bindCommand(definitions.back, { ...RUN_PLACE, menu: false, run: () => emit('close') }, t),
  // Off in the panel, where the list beside it has ↓ ↑; the job's log, when shown, keeps them over these.
  bindCommand(definitions.lineDown, { ...SCROLL, title: t(l.scrollDown), run: () => scrollKeys.move(1) }, t),
  bindCommand(definitions.lineUp, { ...SCROLL, title: t(l.scrollUp), run: () => scrollKeys.move(-1) }, t),
  bindCommand(definitions.pageDown, { ...SCROLL, title: t(l.screenDown), run: () => scrollKeys.page(1) }, t),
  bindCommand(definitions.pageUp, { ...SCROLL, title: t(l.screenUp), run: () => scrollKeys.page(-1) }, t),
]);

let roomObserver: ResizeObserver | undefined;
// Arrived from a row or a tick, the keys are the page's: Enter no longer presses what was clicked.
onMounted(() => {
  root.value?.focus({ preventScroll: true });
  const element = roomRef.value;
  if (element) {
    room.value = element.clientWidth;
    roomObserver = new ResizeObserver(() => {
      room.value = element.clientWidth;
    });
    roomObserver.observe(element);
  }
});
onBeforeUnmount(() => roomObserver?.disconnect());

/** "Open full screen" by `⇧Enter`; "Back to the panel" in ⌘K only, Escape being the run's own step back (`back`). */
function getArrangeCommand(other: OtherArrangement): BoundCommand {
  const run = () => emit('arrange', other.arrangement);
  return other.arrangement === 'page'
    ? bindCommand(definitions.openFullScreen, { place: 'workflowRun', section: 'item', run }, t)
    : bindCommand(
        definitions.closeFullScreen,
        { place: 'workflowRun', section: 'item', title: other.title, icon: other.icon, keyed: false, run },
        t,
      );
}

function selectJob(job: GitHubWorkflowJob) {
  // A job clicked gives the keys back: Enter tries a failed log again rather than pressing the job.
  root.value?.focus({ preventScroll: true });
  emit('selectJob', job);
}

function moveJob(by: number) {
  const job = props.model.jobs[selectedIndex.value + by];
  if (!job) {
    return;
  }

  if (atOverview.value) {
    cursorId.value = job.id;
  } else {
    emit('selectJob', job);
  }
}

function openCursorJob() {
  const job = cursorJob.value;
  if (job) {
    emit('selectJob', job);
  }
}

function getFailedMessage(heading: string, path: string, httpStatus: number | null): RunMessage {
  return {
    icon: Unplug,
    tone: 'warning',
    title: heading,
    text: httpStatus === null ? t(l.failedNoAnswerText) : t(l.failedText, { status: httpStatus }),
    detail: httpStatus === null ? t(l.failedNoAnswerDetail, { path }) : t(l.failedDetail, { path, status: httpStatus }),
    gitHubLabel: t(definitions.openOnGitHub.title),
    retry: true,
  };
}

function getInvalidFileMessage(): RunMessage {
  const { workflowPath } = props;
  return {
    icon: FileX,
    tone: 'broken',
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
      <ChevronRight
        :class="css.workflowRunView_separator"
        aria-hidden="true"
      />
      <!-- Named as the run is ("Deploy #4825"): the chevron between is hidden from screen readers. -->
      <h1 :class="css.workflowRunView_title">
        <template v-if="model.run?.workflowName">
          <RouterLink
            v-if="workflowPage"
            :to="workflowPage"
            :class="css.workflowRunView_workflow"
            >{{ model.run.workflowName }}</RouterLink
          >
          <span
            v-else
            :class="css.workflowRunView_workflow"
            >{{ model.run.workflowName }}</span
          >
          {{ ' ' }}
          <ChevronRight
            :class="css.workflowRunView_separator"
            aria-hidden="true"
          />
          <span :class="css.workflowRunView_number">{{ t(l.number, { number: model.run.runNumber }) }}</span>
        </template>
        <span
          v-else
          :class="css.workflowRunView_number"
          >{{ title }}</span
        >
      </h1>
      <span :class="css.workflowRunView_spacer" />
      <IconButton
        v-if="otherArrangement"
        :icon="otherArrangement.icon"
        :label="otherArrangement.title"
        :kbd="otherArrangement.arrangement === 'page' ? keyOf(definitions.openFullScreen) : undefined"
        :keyshortcuts="otherArrangement.arrangement === 'page' ? keyOf(definitions.openFullScreen) : undefined"
        @click="emit('arrange', otherArrangement.arrangement)"
      />
      <IconButton
        :icon="Github"
        :label="t(definitions.openOnGitHub.title)"
        :kbd="keyOf(definitions.openOnGitHub)"
        :link="gitHubUrl"
        target="_blank"
        rel="noopener noreferrer"
        :keyshortcuts="keyOf(definitions.openOnGitHub)"
      />
      <IconButton
        :icon="X"
        :label="t(l.back)"
        :kbd="keyOf(definitions.back)"
        :keyshortcuts="keyOf(definitions.back)"
        @click="emit('close')"
      />
    </header>
    <div
      ref="room"
      :class="css.workflowRunView_room"
    >
      <div
        :class="[css.workflowRunView_box, !page && css.workflowRunView_box_panel]"
        :style="page ? { width: `${box.shown}px` } : undefined"
      >
        <template v-if="page">
          <WidthHandle
            v-for="side in ['left', 'right'] as const"
            :key="side"
            v-model="box.current"
            :side="side"
            :label="t(l.resizePage)"
            :min="PAGE_WIDTH.min"
            :max="room"
            @resized="box.save()"
          />
        </template>
        <WorkflowRunSummary
          :run="model.run"
          :git-ref="gitRef"
          :still-broken="stillBroken"
          :now="now"
        />
        <ColumnSplit
          v-if="showsColumns"
          shown
          :width="JOBS_WIDTH"
          :label="t(l.resizeJobs)"
        >
          <template #column>
            <WorkflowRunJobs
              :jobs="model.jobs"
              :counts="model.counts"
              :selected-id="markedJob?.id ?? null"
              :loading="model.body.kind === 'loading'"
              :now="now"
              :matches="logMatches"
              :hide-steps="atOverview"
              @select="selectJob"
            />
          </template>
          <template v-if="atOverview">
            <div
              ref="overview"
              :class="css.workflowRunView_overview"
            >
              <WorkflowRunOverview
                :run="model.run"
                :jobs="model.jobs"
                :counts="model.counts"
                :now="now"
              />
            </div>
            <footer
              :class="css.workflowRunView_keys"
              aria-hidden="true"
            >
              <span
                v-for="hint in hints"
                :key="hint.id"
                :class="css.workflowRunView_hint"
              >
                <Kbd
                  v-for="key in hint.keys"
                  :key="key"
                  :keys="key"
                />
                {{ hint.label }}
              </span>
            </footer>
          </template>
          <WorkflowRunLogPane
            v-else
            v-model:query="logQuery"
            v-model:matches="logMatches"
            :pane="logPane"
            :name-with-owner="nameWithOwner"
            :run-id="runId"
            :line-address="lineAddress"
            :run-created-at="model.run?.createdAt ?? null"
            :now="now"
            @retry="emit('retry')"
            @open-on-git-hub="emit('openOnGitHub', gitHubUrl)"
          />
        </ColumnSplit>
        <div
          v-else-if="message"
          :class="css.workflowRunView_message"
        >
          <EmptyState
            place="screen"
            :icon="message.icon"
            :tone="message.tone"
            :title="message.title"
            :detail="message.text"
            :fact="message.detail"
          >
            <template #action>
              <Button
                v-if="message.retry"
                variant="secondary"
                size="sm"
                :icon="RotateCw"
                :kbd="keyOf(definitions.tryAgain)"
                :keyshortcuts="keyOf(definitions.tryAgain)"
                @click="emit('retry')"
              >
                {{ t(l.tryAgain) }}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                :icon="Github"
                :kbd="keyOf(definitions.openOnGitHub)"
                :keyshortcuts="keyOf(definitions.openOnGitHub)"
                @click="emit('openOnGitHub', gitHubUrl)"
              >
                {{ message.gitHubLabel }}
              </Button>
            </template>
          </EmptyState>
        </div>
      </div>
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
  @include list-header;

  padding-right: $spacing-14;
  font-size: $font-size-sm;
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

.workflowRunView_separator {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}

.workflowRunView_title {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: inherit;
  font-weight: $font-weight-normal;
  white-space: nowrap;
}

.workflowRunView_workflow {
  overflow: hidden;
  color: $color-fg-2;
  text-decoration: none;
  text-overflow: ellipsis;

  &:is(a):hover {
    color: $color-fg;
    text-decoration: underline;
  }

  &:focus-visible {
    @include focus-outline(2px);
    border-radius: $radius-sm;
  }
}

.workflowRunView_number {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.workflowRunView_spacer {
  flex: 1;
}

.workflowRunView_room {
  display: flex;
  flex: 1;
  min-height: 0;
}

// The item page's box (D9): centred, its width the user's, drawn at most the width there is.
.workflowRunView_box {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-inline: auto;
}

// In the panel the box is the panel's whole width.
.workflowRunView_box_panel {
  flex: 1;
  min-width: 0;
  margin-inline: 0;
}

.workflowRunView_overview {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.workflowRunView_keys {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: $spacing-16;
  align-items: center;
  padding: $spacing-8 $spacing-16;
  border-top: 1px solid $color-border;
}

.workflowRunView_hint {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.workflowRunView_message {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
