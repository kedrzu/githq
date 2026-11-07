<!-- `/dashboard/workflows` (actions W2): every broken workflow of the tracked repositories, from the local copy (`WorkflowStore`), and the repositories not read yet or GitHub shows nothing of. Opening it polls the workflows at once rather than at the next turn of their loop (D2); the status bar tells how fresh they are (`layouts/shell.vue`). What stands in the way of reading any (offline, paused, GitHub failing) goes to the screen; the workflows' loop asks again at its own pace (first run and loading D12). A workflow opens its latest failed run on its page in githq, and Back or Esc there comes back to the same row (`WorkflowTabPlaces`). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted } from 'vue';

import { useNow } from '@/services/useNow.js';
import { ItemStore } from '@/store/ItemStore.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { getCantBeReadCause } from '@/utils/getCantBeReadCause.js';

import type { BrokenWorkflowEntry } from './buildBrokenWorkflows.js';
import { buildBrokenWorkflows } from './buildBrokenWorkflows.js';
import BrokenWorkflowsView from './BrokenWorkflowsView.vue';
import { useOpenWorkflowRun } from './useOpenWorkflowRun.js';
import { WorkflowStore } from './WorkflowStore.js';
import { WorkflowTabPlaces } from './WorkflowTabPlaces.js';

/** How often "broken for 3h" and "failed 14m ago" move on. */
const TICK_MS = 30_000;

const store = useService(WorkflowStore);
const items = useService(ItemStore);
const sync = useService(SyncEngine);
const places = useService(WorkflowTabPlaces);
const openRun = useOpenWorkflowRun();
const now = useNow(TICK_MS);

const broken = computed(() => buildBrokenWorkflows(store.repositories));
const cantBeRead = computed(() =>
  getCantBeReadCause({ freshness: sync.getWorkflowsFreshness(), retry: () => sync.pollNow(['workflows']) }),
);
const selected = computed({
  get: () => places.brokenSelected,
  set: (key: string | null) => places.setBrokenSelected(key),
});

onMounted(() => sync.pollNow(['workflows']));

function open(entry: BrokenWorkflowEntry) {
  const run = entry.workflow.latestFailedRun;
  if (run) {
    openRun(entry.nameWithOwner, run);
  }
}
</script>

<template>
  <BrokenWorkflowsView
    v-model:selected="selected"
    :broken="broken"
    :cant-be-read="cantBeRead"
    :checked-at="items.getSyncState('workflows').lastSuccessAt"
    :now="now"
    @open="open"
  />
</template>
