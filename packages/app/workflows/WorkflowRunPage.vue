<!-- `/owner/name/actions/runs/123` and `…/job/456`: a run of a tracked repository's workflow (actions W4a), at GitHub's addresses of it, full page; a repository not tracked hands off to GitHub (`middleware/auth.global.ts`, D4). What the local copy knows shows at once, the run, its jobs and the selected job's log are read on demand (`WorkflowRunStore`, D12), and asked again on opening, for what changed since (304s are free). While the run goes it is asked again every 30 seconds, which is also how a running job's log opens by itself once it finishes (W4j). The job the address names is selected, else the first failed; selecting one replaces the address. Esc goes back where the run was opened from — the row kept (`WorkflowTabPlaces`) —, with no history to the repository's Workflows tab. -->
<script lang="ts" setup>
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted, onScopeDispose, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { useNow } from '@/services/useNow.js';
import {
  getGitHubUrl,
  getRepositoryPath,
  getRouteNameWithOwner,
  getWorkflowRunPath,
  isWorkflowRunRoute,
} from '@/tracking/trackingRoutes.js';

import { buildWorkflowRun, getWorkflowLogPane } from './buildWorkflowRun.js';
import { getRefKind } from './utils/getRefKind.js';
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
const model = computed(() =>
  buildWorkflowRun({
    run: store.getRun(nameWithOwner, runId),
    jobs: store.getJobs(nameWithOwner, runId),
    jobId: jobId.value,
  }),
);
// Only with the columns shown: a run GitHub no longer shows reads no log.
const logPane = computed(() =>
  getWorkflowLogPane(model.value.body.kind === 'jobs' ? model.value.selectedJob : null, job =>
    store.getLog(nameWithOwner, job.id, job.steps),
  ),
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
  () => model.value.going,
  going => {
    cancelRefresh?.();
    cancelRefresh = null;
    if (going) {
      scheduleRefresh();
    }
  },
  { immediate: true },
);
onScopeDispose(() => cancelRefresh?.());
onMounted(() => store.refresh(nameWithOwner, runId));

function scheduleRefresh() {
  cancelRefresh = clock.schedule(() => {
    store.refresh(nameWithOwner, runId);
    scheduleRefresh();
  }, REFRESH_MS);
}

function selectJob(job: GitHubWorkflowJob) {
  void router.replace(getWorkflowRunPath(nameWithOwner, runId, job.id));
}

function retry() {
  const pane = logPane.value;
  if (pane.kind === 'failed') {
    store.retry(nameWithOwner, pane.job.id, pane.job.steps);
  } else {
    store.refresh(nameWithOwner, runId);
  }
}

function openOnGitHub() {
  browser.openInNewTab(getGitHubUrl(getWorkflowRunPath(nameWithOwner, runId)));
}

function close() {
  if (router.options.history.state.back) {
    router.back();
  } else {
    void router.replace(getRepositoryPath(nameWithOwner, 'workflows'));
  }
}
</script>

<template>
  <WorkflowRunView
    :name-with-owner="nameWithOwner"
    :run-id="runId"
    :model="model"
    :log-pane="logPane"
    :git-ref="gitRef"
    :workflow-path="workflowPath"
    :still-broken="stillBroken"
    :now="now"
    @select-job="selectJob"
    @retry="retry"
    @open-on-git-hub="openOnGitHub"
    @close="close"
  />
</template>
