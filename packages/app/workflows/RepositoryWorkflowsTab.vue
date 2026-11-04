<!-- `/owner/name/actions` (actions W3a): a tracked repository's Workflows tab, as the repository's page builds it from the local copy (`buildRepositoryWorkflows`). Opening it polls the workflows at once, and while it is shown every poll reads the repository's runs on any ref too (D2, `useAnyRefRead`), which the tab lists though they may raise no alert. A broken workflow opens its latest failed run; any other unfolds in place (W3b): its kept runs at once, more — on any ref, or on the ref filtered by — read on demand a page at a time, the first anew at each unfold (`WorkflowRunHistory`, D12), never kept. A run opens on its page in githq (W4a). P opens the repository's settings on Workflow alerts — on its add field from a workflow failing only where nothing raises alerts —, and Esc there comes back here, to the same row, unfolded as it was (`WorkflowTabPlaces`, W13). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Browser } from '@/services/Browser.js';
import { getRepositorySettingsPath } from '@/tracking/trackingRoutes.js';

import type { RepositoryWorkflowList } from './buildRepositoryWorkflows.js';
import { buildUnfoldedWorkflow } from './buildUnfoldedWorkflow.js';
import RepositoryWorkflowsView from './RepositoryWorkflowsView.vue';
import { useAnyRefRead } from './useAnyRefRead.js';
import { useOpenWorkflowRun } from './useOpenWorkflowRun.js';
import { WorkflowRunHistory } from './WorkflowRunHistory.js';
import type { WorkflowRunHistoryQuery } from './WorkflowRunHistory.js';
import { WorkflowStore } from './WorkflowStore.js';
import { WorkflowTabPlaces } from './WorkflowTabPlaces.js';

const props = defineProps<{
  /** `owner/name`, tracked. */
  nameWithOwner: string;
  list: RepositoryWorkflowList;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

/** The unfolded workflow's row's key; `null` with none. The page keeps it, as its toolbar's key hints follow it. */
const unfoldedKey = defineModel<string | null>('unfolded', { default: null });

const browser = useService(Browser);
const workflows = useService(WorkflowStore);
const history = useService(WorkflowRunHistory);
const places = useService(WorkflowTabPlaces);
const router = useRouter();
const openRun = useOpenWorkflowRun();
useAnyRefRead(() => props.nameWithOwner);

/** The ref the unfolded workflow's runs are filtered by; `null`: every ref. */
const refFilter = computed({
  get: () => places.get(props.nameWithOwner).refFilter,
  set: (filter: string | null) => places.update(props.nameWithOwner, { refFilter: filter }),
});
/** The selected row's key: back from the repository's settings, the same row (W13). */
const selected = computed({
  get: () => places.get(props.nameWithOwner).selected,
  set: (key: string | null) => places.update(props.nameWithOwner, { selected: key }),
});

/** Whose runs are read on demand: the unfolded workflow's, on the ref filtered by. */
const query = computed((): WorkflowRunHistoryQuery | null => {
  const key = unfoldedKey.value;
  return key === null ? null : { nameWithOwner: props.nameWithOwner, workflowId: Number(key), ref: refFilter.value };
});
const unfolded = computed(() => {
  const stored = workflows.get(props.nameWithOwner);
  const current = query.value;
  if (!stored || !current || !stored.workflows.some(entry => entry.workflow.id === current.workflowId)) {
    return null;
  }

  return buildUnfoldedWorkflow({
    stored,
    workflowId: current.workflowId,
    ref: current.ref,
    history: history.get(current),
    anyRef: history.get({ ...current, ref: null }).runs,
  });
});

// Another workflow unfolded shows every ref of it again.
watch(unfoldedKey, () => {
  refFilter.value = null;
});
// Unfolded, or filtered by another ref, the first page of its runs is read anew at once.
watch(
  query,
  current => {
    if (current) {
      history.refresh(current);
    }
  },
  { immediate: true },
);

function readMore() {
  if (query.value) {
    history.readMore(query.value);
  }
}

function openSettings(addPattern: boolean) {
  void router.push(getRepositorySettingsPath(props.nameWithOwner, addPattern ? 'workflowAlertsAdd' : 'workflowAlerts'));
}
</script>

<template>
  <RepositoryWorkflowsView
    v-model:selected="selected"
    :name-with-owner="nameWithOwner"
    :list="list"
    :now="now"
    :unfolded="unfolded"
    @open-run="openRun(nameWithOwner, $event)"
    @unfold="unfoldedKey = $event"
    @filter="refFilter = $event"
    @read-more="readMore"
    @settings="openSettings"
    @open-on-git-hub="browser.openInNewTab($event)"
  />
</template>
