<!-- The workflow an address opens, in its arrangement (actions D15): found among the repository's workflows and kept current (`useOpenedWorkflow`, which reads its runs' first page and its file as it opens), shown in the workflow view — in the panel beside the Workflows section or on its page — and moved as any opened item is (`useItemArrangement`): "Open full screen" (`⇧Enter`) expands it from the panel, Escape goes back the way it came — the list selecting the workflow opened last (`ItemNavigation.lastOpenedId`, by its key) —, `⇧K`/`⇧J` step through the list of workflows it was opened from, by their keys (`WorkflowRoutes.formatKey`). A run opens on its page, Back returning here; the filters and the grouping set there go to the run history and the settings. Until the repository's workflows are read it says it is opening; once read, a workflow not among them is said missing. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowLeft, SearchX } from 'lucide-vue-next';
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import type { ItemArrangement } from '@/item/itemRoutes.js';
import { useItemArrangement } from '@/item/useItemArrangement.js';
import { useNow } from '@/services/useNow.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import * as l from './OpenedWorkflow.loc.js';
import { useOpenedWorkflow } from './useOpenedWorkflow.js';
import { useOpenWorkflowRun } from './useOpenWorkflowRun.js';
import { WorkflowRunHistory } from './WorkflowRunHistory.js';
import type { WorkflowRunFilters } from './WorkflowRunHistory.js';
import { parseWorkflowKey, WorkflowRoutes } from './workflowRoutes.js';
import type { WorkflowReference } from './workflowRoutes.js';
import WorkflowView from './WorkflowView.vue';

const props = defineProps<{
  reference: WorkflowReference;
  arrangement: ItemArrangement;
}>();

/** How often the ages ("2h") move on. */
const TICK_MS = 30_000;

const t = useTranslate();
const history = useService(WorkflowRunHistory);
const tracking = useService(TrackingStore);
const navigation = useService(ItemNavigation);
const route = useRoute();
const router = useRouter();
const now = useNow(TICK_MS);
const openRun = useOpenWorkflowRun();

const opened = useOpenedWorkflow({ reference: () => props.reference });
const arranging = useItemArrangement({
  routes: WorkflowRoutes,
  reference: () => props.reference,
  arrangement: () => props.arrangement,
  // Its key among the steps of a list of workflows: found once it is among the repository's workflows.
  id: () => (opened.state ? WorkflowRoutes.formatKey(props.reference) : null),
  resolveStep: key => {
    const reference = parseWorkflowKey(key);
    return reference && { reference };
  },
});
const { walk } = arranging;

// The workflow opened last, by its key: the list it was opened from selects it when it comes back (`⇧J`/`⇧K` moved on).
watch(
  () => (opened.state ? WorkflowRoutes.formatKey(props.reference) : null),
  key => {
    if (key !== null) {
      navigation.setLastOpened(key);
    }
  },
  { immediate: true },
);

const referenceText = computed(() => `${opened.nameWithOwner} ${props.reference.file}`);
/** Escape from full screen goes back to the panel when the page was expanded from it and the panel fits. */
const escapeTo = computed(() => {
  // Read again as the address changes: the history's state is not reactive.
  void route.fullPath;
  return WorkflowRoutes.getExpandedFrom(router.options.history.state) !== null && navigation.panelFits
    ? 'panel'
    : 'list';
});

function setFilters(filters: WorkflowRunFilters) {
  if (opened.target) {
    history.setFilters(opened.target, filters);
  }
}

function readMore() {
  if (opened.target) {
    history.readMoreRuns(opened.target);
  }
}
</script>

<template>
  <WorkflowView
    v-if="opened.state && opened.details && opened.runs"
    :arrangement="arrangement"
    :position="walk.position"
    :name-with-owner="opened.nameWithOwner"
    :state="opened.state"
    :details="opened.details"
    :runs="opened.runs"
    :ref-groups="opened.refGroups"
    :tags="opened.tags"
    :group-by="tracking.workflowRunsGroupBy"
    :latest-failure="opened.latestFailure"
    :escape-to="escapeTo"
    :now="now"
    @close="arranging.close()"
    @previous="arranging.step(-1)"
    @next="arranging.step(1)"
    @arrange="arranging.arrange($event)"
    @open-run="openRun(opened.nameWithOwner, $event)"
    @filter="setFilters"
    @read-more="readMore"
    @group-by="tracking.setWorkflowRunsGroupBy($event)"
  />
  <div
    v-else
    :class="css.openedWorkflow_waiting"
  >
    <EmptyState
      :icon="SearchX"
      tone="muted"
      :title="opened.missing ? t(l.missing) : t(l.opening, { reference: referenceText })"
      :detail="opened.missing ? t(l.missingDetail, { reference: referenceText }) : undefined"
      :fact="opened.missing ? t(l.missingFact, { reference: referenceText }) : undefined"
    >
      <template
        v-if="opened.missing"
        #action
      >
        <Button
          variant="secondary"
          size="sm"
          :icon="ArrowLeft"
          @click="arranging.close()"
        >
          {{ t(l.backToList) }}
        </Button>
      </template>
    </EmptyState>
  </div>
</template>

<style lang="scss" module="css">
.openedWorkflow_waiting {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: $color-bg-item;
}
</style>
