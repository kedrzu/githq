<!-- `/owner/name/actions/runs/123` and `…/job/456`: a run of a tracked repository's workflow (actions W4a), at GitHub's addresses of it, full page; a repository not tracked hands off to GitHub (`middleware/auth.global.ts`, D4). What the local copy knows shows at once, the run, its jobs and the selected job's log are read on demand (`WorkflowRunStore`, D12), and asked again on opening, for what changed since (304s are free). While the run goes it is asked again every 30 seconds, which is also how a running job's log opens by itself once it finishes (W4j); so is a job's log GitHub has no answer for in the first minutes after the job finished. A log GitHub had no answer for is asked for again on coming back to its job, as it may have landed meanwhile. An address with `#step:N:L` puts the log's cursor on that line of the job it names, and on no other's. The job the address names is selected, else the one shown so far, else the first failed: as the run goes the jobs change places, and a job that passes or another that fails takes nothing over, reached by ⌥J/⌥K in its place at the top. Selecting one replaces the address. The status bar says what the log's state is about (`WorkflowRunStore.pageFreshness`). Re-running the failed jobs is the store's (W4j, W4l): the page follows as the run goes, and the answer, whenever it comes, is shown above the page. Esc goes back where the run was opened from — the row kept (`WorkflowTabPlaces`) —, with no history to the repository's Workflows tab. -->
<script lang="ts" setup>
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { useNow } from '@/services/useNow.js';
import type { Freshness } from '@/sync/Freshness.js';
import {
  getRepositoryPath,
  getRouteNameWithOwner,
  getWorkflowRunPath,
  isWorkflowRunRoute,
} from '@/tracking/trackingRoutes.js';
import { goBack } from '@/utils/goBack.js';

import { buildWorkflowRun, canRerunFailedJobs, getWorkflowLogPane } from './buildWorkflowRun.js';
import { getRefKind } from './utils/getRefKind.js';
import { parseLogLineHash } from './utils/logLineHash.js';
import { WorkflowRunStore } from './WorkflowRunStore.js';
import WorkflowRunView from './WorkflowRunView.vue';
import { WorkflowStore } from './WorkflowStore.js';
import type { WorkflowRowRef } from './WorkflowTypes.js';

/** How often a run still going is asked again, and what is running is counted on. */
const REFRESH_MS = 30_000;

const route = useRoute();
const router = useRouter();
const store = useService(WorkflowRunStore);
const workflows = useService(WorkflowStore);
const repositories = useService(RepositoryStore);
const browser = useService(Browser);
const clock = useService(Clock);
const now = useNow(REFRESH_MS);

// One run per page instance (`meta.key`): fixed for its life, whatever the route says as it is left.
const nameWithOwner = getRouteNameWithOwner(route);
const runId = Number(route.params.run);

const jobId = computed<number | null>(previous => {
  if (!isWorkflowRunRoute(route)) {
    return previous ?? null;
  }

  return route.name === 'workflow-run-job' ? Number(route.params.job) : null;
});
/** Fixed for the page's life with its run (`meta.key`), so another run starts with none; a job gone from the run gives way. */
const shownJobId = ref<number | null>(null);
const model = computed(() =>
  buildWorkflowRun({
    run: store.getRun(nameWithOwner, runId),
    jobs: store.getJobs(nameWithOwner, runId),
    jobId: jobId.value,
    shownJobId: shownJobId.value,
  }),
);
const canRerun = computed(() => canRerunFailedJobs(model.value, repositories.get(nameWithOwner)));
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
// Only in the job it was copied from: a job shown in place of one the run no longer has has its own line 10.
const lineAddress = computed(() =>
  route.name === 'workflow-run-job' && model.value.selectedJob?.id === jobId.value
    ? parseLogLineHash(route.hash)
    : null,
);
const stored = computed(() => workflows.get(nameWithOwner));
const gitRef = computed((): WorkflowRowRef | null => {
  const name = model.value.run?.headBranch ?? null;
  if (name === null) {
    return null;
  }

  return { name, kind: stored.value ? getRefKind(stored.value, name) : 'branch' };
});
const workflowPath = computed(() => {
  const id = model.value.run?.workflowId;
  return stored.value?.workflows.find(entry => entry.workflow.id === id)?.workflow.path ?? null;
});
const stillBroken = computed(() => {
  const id = model.value.run?.workflowId;
  return workflows
    .getState(nameWithOwner)
    .workflows.some(entry => entry.workflow.id === id && entry.state === 'broken');
});

let cancelRefresh: (() => void) | null = null;

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
watch(
  pageFreshness,
  freshness => {
    store.setPageFreshness(freshness);
  },
  { immediate: true },
);
// Coming back to a job, or to the page: what GitHub had no log for then may have landed, with nothing asking meanwhile.
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
  store.setPageFreshness(null);
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

function selectJob(job: GitHubWorkflowJob) {
  void router.replace(getWorkflowRunPath({ nameWithOwner, runId, jobId: job.id }));
}

function retry() {
  const pane = logPane.value;
  if (pane.kind === 'failed' || pane.kind === 'refused') {
    store.retry({ nameWithOwner, jobId: pane.job.id, steps: pane.job.steps });
  } else {
    store.refresh(nameWithOwner, runId);
  }
}

function close() {
  goBack(router, getRepositoryPath(nameWithOwner, 'workflows'));
}
</script>

<template>
  <WorkflowRunView
    :name-with-owner="nameWithOwner"
    :run-id="runId"
    :model="model"
    :log-pane="logPane"
    :line-address="lineAddress"
    :git-ref="gitRef"
    :workflow-path="workflowPath"
    :still-broken="stillBroken"
    :can-rerun="canRerun"
    :now="now"
    @select-job="selectJob"
    @rerun="store.rerun(nameWithOwner, runId)"
    @retry="retry"
    @open-on-git-hub="browser.openInNewTab($event)"
    @close="close"
  />
</template>
