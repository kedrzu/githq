<!-- `/dashboard/workflows` (actions W2): every broken workflow of the tracked repositories, from the local copy (`WorkflowStore`), and the repositories not read yet or GitHub shows nothing of. Opening it polls the workflows at once rather than at the next turn of their loop (D2); the status bar tells how fresh they are (`layouts/shell.vue`). A workflow opens its latest failed run — for now its page on GitHub, in a new tab. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted } from 'vue';

import { useNow } from '@/services/useNow.js';
import { ItemStore } from '@/store/ItemStore.js';
import { SyncEngine } from '@/sync/SyncEngine.js';

import type { BrokenWorkflowEntry } from './buildBrokenWorkflows.js';
import { buildBrokenWorkflows } from './buildBrokenWorkflows.js';
import BrokenWorkflowsView from './BrokenWorkflowsView.vue';
import { useOpenWorkflowRun } from './useOpenWorkflowRun.js';
import { WorkflowStore } from './WorkflowStore.js';

/** How often "broken for 3h" and "failed 14m ago" move on. */
const TICK_MS = 30_000;

const store = useService(WorkflowStore);
const items = useService(ItemStore);
const sync = useService(SyncEngine);
const openRun = useOpenWorkflowRun();
const now = useNow(TICK_MS);

const broken = computed(() => buildBrokenWorkflows(store.repositories));

onMounted(() => sync.pollWorkflowsNow());

function open(entry: BrokenWorkflowEntry) {
  const run = entry.workflow.latestFailedRun;
  if (run) {
    openRun(run);
  }
}
</script>

<template>
  <BrokenWorkflowsView
    :broken="broken"
    :checked-at="items.getSyncState('workflows').lastSuccessAt"
    :now="now"
    @open="open"
  />
</template>
