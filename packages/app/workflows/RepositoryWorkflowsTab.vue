<!-- `/owner/name/actions` (actions W3a, W35, D15): a tracked repository's Workflows section, as the repository's page builds it from the local copy (`buildRepositoryWorkflows`). Opening it polls the workflows at once, and while it is shown every poll reads the repository's runs on any ref too (D2, `useAnyRefRead`), which the tab lists though they may raise no alert. A workflow opens as an item (`OpenedWorkflow`): in the panel beside the section when it fits (`?pane=workflow&workflow=…`), else on its page; the one open in the panel expands to its page, marked for Back to the panel; ⇧Enter opens one full screen straight, Esc there coming back here. The section is the list the opened workflow steps through (`ItemNavigation.list`, by `WorkflowRoutes.formatKey`). F opens a workflow's latest failed run on its page in githq (W4a). P opens the repository's settings on Workflow alerts — on its add field from a workflow failing only where nothing raises alerts —, and Esc there, as from a run's page, comes back here to the same row (`WorkflowTabPlaces`, W13); from a workflow, to the row of the one opened last (`ItemNavigation.lastOpenedId`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ItemNavigation } from '@/item/ItemNavigation.js';
import { Browser } from '@/services/Browser.js';
import { getRepositorySettingsPath } from '@/tracking/trackingRoutes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import type { RepositoryWorkflowList } from './buildRepositoryWorkflows.js';
import RepositoryWorkflowsView from './RepositoryWorkflowsView.vue';
import { useAnyRefRead } from './useAnyRefRead.js';
import { useOpenWorkflowRun } from './useOpenWorkflowRun.js';
import * as l from './RepositoryWorkflowsTab.loc.js';
import { getWorkflowFile } from './utils/getWorkflowFile.js';
import { WorkflowRoutes } from './workflowRoutes.js';
import type { WorkflowReference } from './workflowRoutes.js';
import { WorkflowTabPlaces } from './WorkflowTabPlaces.js';

const props = defineProps<{
  /** `owner/name`, tracked. */
  nameWithOwner: string;
  list: RepositoryWorkflowList;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const t = useTranslate();
const browser = useService(Browser);
const navigation = useService(ItemNavigation);
const places = useService(WorkflowTabPlaces);
const route = useRoute();
const router = useRouter();
const openRun = useOpenWorkflowRun();
useAnyRefRead(() => props.nameWithOwner);

/** The selected row's key: back from the repository's settings, a run or a workflow's page, the same row (W13). */
const selected = computed({
  get: () => places.get(props.nameWithOwner).selected,
  set: (key: string | null) => places.update(props.nameWithOwner, { selected: key }),
});
/** Each row's workflow, by the row's key, in the section's order. */
const references = computed(() => {
  const repository = parseRepositoryName(props.nameWithOwner);
  const found = new Map<string, WorkflowReference>();
  for (const group of props.list.groups) {
    for (const row of group.rows) {
      found.set(row.key, { ...repository, file: getWorkflowFile(row.workflow.workflow) });
    }
  }

  return found;
});
/** The key of the row whose workflow is open in the panel; `null` with none, or one of another repository. */
const openedKey = computed(() => {
  const opened = WorkflowRoutes.getOpened(route);
  if (!opened || opened.onPage) {
    return null;
  }

  const key = WorkflowRoutes.formatKey(opened.reference).toLowerCase();
  for (const [rowKey, reference] of references.value) {
    if (WorkflowRoutes.formatKey(reference).toLowerCase() === key) {
      return rowKey;
    }
  }

  return null;
});
/** The section's address with no workflow open over it: where closing one comes back to. */
const listPath = computed(
  () => router.resolve({ path: route.path, query: WorkflowRoutes.getQuery(route.query, null) }).fullPath,
);

// Back from a workflow — or with one stepped to in the panel —, the workflow opened last is the selected row; once.
watch([() => navigation.lastOpenedId, references], ([key, found]) => followOpened(key, found), { immediate: true });
// What an opened workflow steps through (`⇧J`/`⇧K`), and where closing it comes back to, by its name.
watch(
  [references, listPath, () => t(l.title)],
  ([found, path, title]) =>
    navigation.setList({
      kind: 'workflow',
      path,
      title,
      steps: [...found.values()].map(reference => WorkflowRoutes.formatKey(reference)),
      stepOf: new Map(),
      around: null,
    }),
  { immediate: true },
);

/** Selects the row of the workflow opened last, unless the selection went there already (`WorkflowTabPlace.followed`). */
function followOpened(key: string | null, found: ReadonlyMap<string, WorkflowReference>) {
  if (key === null || key === places.get(props.nameWithOwner).followed) {
    return;
  }

  const opened = key.toLowerCase();
  for (const [rowKey, reference] of found) {
    if (WorkflowRoutes.formatKey(reference).toLowerCase() === opened) {
      places.update(props.nameWithOwner, { selected: rowKey, followed: key });
      return;
    }
  }
}

/** In the panel beside the section when it fits — in place of the workflow open there —, else on its page. */
function openWorkflow(key: string) {
  const reference = references.value.get(key);
  if (!reference) {
    return;
  }

  if (!navigation.panelFits) {
    void router.push(WorkflowRoutes.getPagePath(reference));
    return;
  }

  const location = { path: route.path, query: WorkflowRoutes.getQuery(route.query, reference) };
  void (openedKey.value === null ? router.push(location) : router.replace(location));
}

/** The workflow open in the panel, full screen: Back returns to the panel. */
function expandWorkflow(key: string) {
  const reference = references.value.get(key);
  if (reference) {
    void router.push(WorkflowRoutes.getExpandedLocation({ reference }));
  }
}

/** Full screen straight, unmarked: Esc there comes back to the section. */
function openFullScreen(key: string) {
  const reference = references.value.get(key);
  if (reference) {
    void router.push(WorkflowRoutes.getPagePath(reference));
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
    :opened-key="openedKey"
    @open="openWorkflow"
    @expand="expandWorkflow"
    @full-screen="openFullScreen"
    @open-run="openRun(nameWithOwner, $event)"
    @settings="openSettings"
    @open-on-git-hub="browser.openInNewTab($event)"
  />
</template>
