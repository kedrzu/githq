<!-- A workflow's run an address opens (actions W4a), in its arrangement: on its page (`WorkflowRunPage`, GitHub's `/owner/name/actions/runs/123[/job/456]`) or in the panel beside a repository's Workflows section (`?pane=run&run=owner|name|123[|456]`), one instance per run, shown in the run view and moved as any opened item is (`useItemArrangement`): "Open full screen" (`⇧Enter`) expands it from the panel keeping the job, "Back to the panel" returns, and a panel that stops fitting moves it to its page. What the local copy knows shows at once, the run, its jobs and the selected job's log are read on demand (`WorkflowRunStore`, D12), and asked again on opening, for what changed since (304s are free). While the run goes it is asked again every 30 seconds, which is also how a running job's log opens by itself once it finishes (W4j); so is a job's log GitHub has no answer for in the first minutes after the job finished; asking stops as the run leaves the screen or the panel. A log GitHub had no answer for is asked for again on coming back to its job, as it may have landed meanwhile. An address with `#step:N:L` puts the log's cursor on that line of the job it names, and on no other's. A run whose jobs, as first known, have none failed opens at its overview (W34) and stays there with no job in the address, whatever fails later; one with a failure opens at it and stays there through a re-run. Opening a job's log from the overview pushes, so Back returns to the overview; between jobs the address is replaced — the page's address on the page, the pane's in the panel. The job the address names is selected, else the one shown so far, else the first failed: as the run goes the jobs change places, and a job that passes or another that fails takes nothing over, reached by ⌥J/⌥K in its place at the top. Only on the page does the status bar say what the log's state is about (`WorkflowRunStore.pageFreshness`). Re-running the failed jobs is the store's (W4j, W4l): the run follows as it goes, and the answer, whenever it comes, is shown above the screen. Esc on the page: expanded from the panel while it fits, back to it; else back where the run was opened from — the workflow in its arrangement, Broken workflows, the row kept (`WorkflowTabPlaces`) —, with no history to the run's workflow's page, or to the repository's Workflows section while the workflow isn't known. Esc in the panel goes back the way it came when the entry behind is the same list with this run, its workflow or nothing open; else up to the run's workflow in the panel, or, while that isn't known, closes the panel. -->
<script lang="ts" setup>
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import type { RouteLocation, RouteLocationRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

import { ItemNavigation } from '@/item/ItemNavigation.js';
import { getHistoryBack, getOpenedItemRoute } from '@/item/itemRoutes.js';
import type { ItemArrangement } from '@/item/itemRoutes.js';
import { useItemArrangement } from '@/item/useItemArrangement.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { useNow } from '@/services/useNow.js';
import type { Freshness } from '@/sync/Freshness.js';
import { getRepositoryPath, getWorkflowRunPath } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { TypographyStore } from '@/typography/TypographyStore.js';
import { goBack } from '@/utils/goBack.js';

import { buildWorkflowRun, canRerunFailedJobs, getWorkflowLogPane, opensAtOverview } from './buildWorkflowRun.js';
import { getRefKind } from './utils/getRefKind.js';
import { getRepositoryDispatchBlock } from './utils/getRepositoryDispatchBlock.js';
import { getWorkflowFile } from './utils/getWorkflowFile.js';
import { parseLogLineHash } from './utils/logLineHash.js';
import { WorkflowRunStore } from './WorkflowRunStore.js';
import type { WorkflowRunTarget } from './WorkflowRunStore.js';
import WorkflowRunView from './WorkflowRunView.vue';
import { WorkflowStore } from './WorkflowStore.js';
import type { WorkflowRowRef } from './WorkflowTypes.js';
import { WorkflowRoutes } from './workflowRoutes.js';
import type { WorkflowReference } from './workflowRoutes.js';
import { WorkflowRunRoutes } from './workflowRunRoutes.js';
import type { WorkflowRunReference } from './workflowRunRoutes.js';

const props = defineProps<{
  /** The run and the job its address names; the run is fixed for the instance's life (it is keyed per run). */
  reference: WorkflowRunReference;
  arrangement: ItemArrangement;
}>();

/** How often a run still going is asked again, and what is running is counted on. */
const REFRESH_MS = 30_000;

const route = useRoute();
const router = useRouter();
const store = useService(WorkflowRunStore);
const workflows = useService(WorkflowStore);
const repositories = useService(RepositoryStore);
const browser = useService(Browser);
const tracking = useService(TrackingStore);
const typography = useService(TypographyStore);
const navigation = useService(ItemNavigation);
const clock = useService(Clock);
const now = useNow(REFRESH_MS);

// One run per instance (the page's `meta.key`, the panel's `key`): fixed for its life, whatever the address says next.
const { owner, name, runId } = props.reference;
const nameWithOwner = `${owner}/${name}`;
const runKey = WorkflowRunRoutes.formatKey(props.reference);

const jobId = computed(() => props.reference.jobId);
/** Fixed for the instance's life with its run, so another run starts with none; a job gone from the run gives way. */
const shownJobId = ref<number | null>(null);
/** Decided once, as the jobs are first known (`opensAtOverview`); `null` until then. */
const overview = ref<boolean | null>(null);
/** On the page, where Back went from the run as the page opened: read before a job's log is pushed over it. */
const backPath = router.options.history.state.back;
const model = computed(() =>
  buildWorkflowRun({
    run: store.getRun(nameWithOwner, runId),
    jobs: store.getJobs(nameWithOwner, runId),
    jobId: jobId.value,
    shownJobId: shownJobId.value,
    overview: overview.value === true,
  }),
);
const canRerun = computed(() => canRerunFailedJobs(model.value, repositories.get(nameWithOwner)));
/** Re-running and cancelling go by the same gate as re-running the failed jobs: write access, not archived. */
const canChangeRuns = computed(() => getRepositoryDispatchBlock(repositories.get(nameWithOwner)) === null);
// Only with the columns shown: a run GitHub no longer shows reads no log.
const logPane = computed(() =>
  getWorkflowLogPane({
    job: model.value.body.kind === 'jobs' ? model.value.selectedJob : null,
    readLog: job => store.getLog({ nameWithOwner, jobId: job.id, steps: job.steps }),
    now: now.value,
  }),
);
const logNotThereYet = computed(() => logPane.value.kind === 'loading' && logPane.value.notThereYet === true);
const pageFreshness = computed((): Freshness | null => {
  const pane = logPane.value;
  switch (pane.kind) {
    case 'loading':
      return pane.job ? { kind: 'readingLog', job: pane.job.name } : null;
    case 'failed':
    case 'tooLarge':
    case 'refused':
      return { kind: 'logFailed', job: pane.job.name };
    case 'running': {
      const { checkedAt } = store.getJobs(nameWithOwner, runId);
      return checkedAt === null ? null : { kind: 'statusChecked', checkedAt };
    }
    case 'neverRan':
    case 'gone':
    case 'ready':
      return null;
    default:
      return assertNever(pane);
  }
});
// Only in the job it was copied from, while the address still shows the run: a job shown in place of one the run no
// longer has has its own line 10.
const lineAddress = computed(() => {
  const shown = WorkflowRunRoutes.getOpened(route)?.reference ?? null;
  return shown !== null &&
    shown.jobId !== null &&
    WorkflowRunRoutes.formatKey(shown) === runKey &&
    model.value.selectedJob?.id === shown.jobId
    ? parseLogLineHash(route.hash)
    : null;
});
const stored = computed(() => workflows.get(nameWithOwner));
const gitRef = computed((): WorkflowRowRef | null => {
  const branch = model.value.run?.headBranch ?? null;
  if (branch === null) {
    return null;
  }

  return { name: branch, kind: stored.value ? getRefKind(stored.value, branch) : 'branch' };
});
const workflow = computed(() => {
  const id = model.value.run?.workflowId;
  return stored.value?.workflows.find(entry => entry.workflow.id === id)?.workflow ?? null;
});
/** The run's workflow as its addresses name it; `null` while the workflow isn't known. */
const workflowReference = computed((): WorkflowReference | null =>
  workflow.value ? { owner, name, file: getWorkflowFile(workflow.value) } : null,
);
const workflowPage = computed(() =>
  workflowReference.value ? WorkflowRoutes.getPagePath(workflowReference.value) : null,
);
const repositoryWorkflows = getRepositoryPath(nameWithOwner, 'workflows');
const arranging = useItemArrangement({
  routes: WorkflowRunRoutes,
  reference: () => props.reference,
  arrangement: () => props.arrangement,
  // Not a step of any list: no `⇧J`/`⇧K` for a run.
  id: () => null,
  parent: () => ({ path: workflowPage.value ?? repositoryWorkflows, title: nameWithOwner }),
  resolveStep: () => null,
});
/**
 * Esc lands on the run's workflow — in the panel whenever it is known (Back goes to it, or up to it); on the page, with
 * no history to its page, or Back goes to it, on its page or in the panel.
 */
const backToWorkflow = computed(() => {
  const reference = workflowReference.value;
  if (props.arrangement === 'panel') {
    return reference !== null;
  }

  if (typeof backPath !== 'string') {
    return backPath == null;
  }

  const opened = WorkflowRoutes.getOpened(router.resolve(backPath));
  return (
    reference !== null &&
    opened !== null &&
    WorkflowRoutes.formatKey(opened.reference) === WorkflowRoutes.formatKey(reference)
  );
});
const stillBroken = computed(() => {
  const id = model.value.run?.workflowId;
  return workflows
    .getState(nameWithOwner)
    .workflows.some(entry => entry.workflow.id === id && entry.state === 'broken');
});

let cancelRefresh: (() => void) | null = null;

watch(
  () => store.getJobs(nameWithOwner, runId).jobs,
  jobs => {
    if (overview.value === null && jobs.length > 0) {
      overview.value = opensAtOverview(jobs);
    }
  },
  { immediate: true },
);

watch(
  () => model.value.selectedJob?.id ?? null,
  id => {
    shownJobId.value = id;
  },
  { immediate: true },
);
watch(
  () => model.value.going || logNotThereYet.value,
  asking => {
    cancelRefresh?.();
    cancelRefresh = null;
    if (asking) {
      scheduleRefresh();
    }
  },
  { immediate: true },
);
// The status bar follows the run only on its page: in the panel the list's freshness stays.
if (props.arrangement === 'page') {
  watch(
    pageFreshness,
    freshness => {
      store.setPageFreshness(freshness);
    },
    { immediate: true },
  );
}

// Coming back to a job, or to the run: what GitHub had no log for then may have landed, with nothing asking meanwhile.
watch(
  () => logPane.value.job?.id,
  () => {
    const pane = logPane.value;
    if (pane.job && (pane.kind === 'gone' || logNotThereYet.value)) {
      store.retry({ nameWithOwner, jobId: pane.job.id, steps: pane.job.steps });
    }
  },
  { immediate: true },
);
onScopeDispose(() => {
  cancelRefresh?.();
  if (props.arrangement === 'page') {
    store.setPageFreshness(null);
  }
});
onMounted(() => {
  store.refresh(nameWithOwner, runId);
  void repositories.ensure(nameWithOwner);
});

function scheduleRefresh() {
  cancelRefresh = clock.schedule(() => {
    store.refresh(nameWithOwner, runId);
    const pane = logPane.value;
    if (logNotThereYet.value && pane.job) {
      store.retry({ nameWithOwner, jobId: pane.job.id, steps: pane.job.steps });
    }

    scheduleRefresh();
  }, REFRESH_MS);
}

// From the overview a job's log is a level in: Back returns to the overview. Between jobs, the address is replaced.
function selectJob(job: GitHubWorkflowJob) {
  const to: RouteLocationRaw =
    props.arrangement === 'page'
      ? getWorkflowRunPath({ nameWithOwner, runId, jobId: job.id })
      : { path: route.path, query: WorkflowRunRoutes.getQuery(route.query, { ...props.reference, jobId: job.id }) };
  void (model.value.body.kind === 'overview' ? router.push(to) : router.replace(to));
}

function retry() {
  const pane = logPane.value;
  if (pane.kind === 'failed' || pane.kind === 'refused') {
    store.retry({ nameWithOwner, jobId: pane.job.id, steps: pane.job.steps });
  } else {
    store.refresh(nameWithOwner, runId);
  }
}

function actOnRun(act: (target: WorkflowRunTarget) => void) {
  const { run } = model.value;
  if (run) {
    act({ nameWithOwner, run });
  }
}

function rerunJob(job: GitHubWorkflowJob) {
  actOnRun(target => store.rerunJob({ ...target, jobId: job.id }));
}

function openWorkflow() {
  if (workflowPage.value) {
    void router.push(workflowPage.value);
  }
}

function close() {
  if (props.arrangement === 'panel') {
    closePanel();
  } else if (WorkflowRunRoutes.getExpandedFrom(router.options.history.state) !== null && navigation.panelFits) {
    arranging.close();
  } else {
    goBack(router, workflowPage.value ?? repositoryWorkflows);
  }
}

/**
 * Back the way it came when the entry behind is the same list with this run, its workflow or nothing open — read as it
 * closes, a job pushed meanwhile having changed it —; else up to the workflow in the panel, or, while that isn't known,
 * the panel closed.
 */
function closePanel() {
  const behind = getHistoryBack(router.options.history.state);
  if (behind !== null && comesBackTo(router.resolve(behind))) {
    router.back();
    return;
  }

  const reference = workflowReference.value;
  void router.replace({
    path: route.path,
    query: reference ? WorkflowRoutes.getQuery(route.query, reference) : WorkflowRunRoutes.getQuery(route.query, null),
  });
}

/** Whether Back from the run in the panel lands where closing it goes: the same list with this run, its workflow or nothing open. */
function comesBackTo(behind: RouteLocation) {
  if (behind.path !== route.path) {
    return false;
  }

  const opened = getOpenedItemRoute(behind);
  if (opened === null) {
    return true;
  }

  switch (opened.kind) {
    case 'run':
      return WorkflowRunRoutes.formatKey(opened.reference) === runKey;
    case 'workflow': {
      const reference = workflowReference.value;
      return reference !== null && WorkflowRoutes.formatKey(opened.reference) === WorkflowRoutes.formatKey(reference);
    }
    case 'issue':
    case 'commit':
      return false;
    default:
      return assertNever(opened);
  }
}
</script>

<template>
  <WorkflowRunView
    :arrangement="arrangement"
    :name-with-owner="nameWithOwner"
    :run-id="runId"
    :model="model"
    :log-pane="logPane"
    :line-address="lineAddress"
    :git-ref="gitRef"
    :workflow-path="workflow?.path ?? null"
    :workflow-page="workflowPage"
    :back-to-workflow="backToWorkflow"
    :still-broken="stillBroken"
    :can-rerun="canRerun"
    :can-change-runs="canChangeRuns"
    :page-width="arrangement === 'page' ? tracking.itemPageWidth : null"
    :now="now"
    :code-typography="typography.applied.code"
    @select-job="selectJob"
    @rerun="store.rerun(nameWithOwner, runId)"
    @rerun-all="actOnRun(store.rerunAll)"
    @rerun-job="rerunJob"
    @cancel="actOnRun(store.cancel)"
    @open-workflow="openWorkflow"
    @retry="retry"
    @open-on-git-hub="browser.openInNewTab($event)"
    @close="close"
    @arrange="arranging.arrange($event)"
    @resize-page="tracking.setMaxWidth('itemPageWidth', $event)"
  />
</template>
