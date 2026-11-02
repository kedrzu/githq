<!-- `/owner/name/actions` (actions W3a): a tracked repository's Workflows tab, as the repository's page builds it from the local copy (`buildRepositoryWorkflows`). Opening it polls the workflows at once, the repository's runs on any ref with them (D2), which the tab lists though they may raise no alert. A broken workflow opens its latest failed run, any other its runs — for now on GitHub, in a new tab; P opens the repository's settings on Workflow alerts, and Esc there comes back here. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Browser } from '@/services/Browser.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { getRepositorySettingsPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';

import type { RepositoryWorkflowEntry, RepositoryWorkflowList } from './buildRepositoryWorkflows.js';
import RepositoryWorkflowsView from './RepositoryWorkflowsView.vue';

const props = defineProps<{
  /** `owner/name`, tracked. */
  nameWithOwner: string;
  list: RepositoryWorkflowList;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const sync = useService(SyncEngine);
const browser = useService(Browser);
const router = useRouter();

onMounted(() => sync.pollWorkflowsNow({ anyRefOf: props.nameWithOwner }));

function open(entry: RepositoryWorkflowEntry) {
  const run = entry.workflow.state === 'broken' ? entry.workflow.latestFailedRun : null;
  browser.openInNewTab(run ? run.htmlUrl : getWorkflowRunsUrl(entry));
}

/** The workflow's runs on GitHub: under its file's name, or the repository's Actions for one GitHub generates. */
function getWorkflowRunsUrl({ workflow }: RepositoryWorkflowEntry) {
  const actions = `${GITHUB_ORIGIN}/${props.nameWithOwner}/actions`;
  return workflow.generated ? actions : `${actions}/workflows/${workflow.workflow.path.split('/').at(-1) ?? ''}`;
}

function openSettings() {
  void router.push(getRepositorySettingsPath(props.nameWithOwner, 'workflowAlerts'));
}
</script>

<template>
  <RepositoryWorkflowsView
    :name-with-owner="nameWithOwner"
    :list="list"
    :now="now"
    @open="open"
    @settings="openSettings"
    @open-on-git-hub="browser.openInNewTab($event)"
  />
</template>
