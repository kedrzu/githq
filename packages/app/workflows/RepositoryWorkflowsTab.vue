<!-- `/owner/name/actions` (actions W3a, W35, D15): a tracked repository's Workflows section, as the repository's page builds it from the local copy (`buildRepositoryWorkflows`). Opening it polls the workflows at once, and while it is shown every poll reads the repository's runs on any ref too (D2, `useAnyRefRead`), which the tab lists though they may raise no alert. A workflow opens as an item (`OpenedWorkflow`): in the panel beside the section when it fits (`?pane=workflow&workflow=…`), else on its page; the one open in the panel expands to its page, marked for Back to the panel; ⇧Enter opens one full screen straight, Esc there coming back here. The section is the list the opened workflow steps through (`ItemNavigation.list`, by `WorkflowRoutes.formatKey`). F opens a workflow's latest failed run (W4a) in the panel when it fits (`?pane=run&run=…`), else on its page in githq; with a run in the panel the row of its workflow is the one marked open, and a click on a row opens that workflow in the run's place. "Run workflow · Deploy" in the command menu runs the selected workflow, or says why it can't (W47, W48). ⇧P opens the repository's settings on Workflow alerts — on its add field from a workflow failing only where nothing raises alerts —, and Esc there, as from a run's page, comes back here to the same row (`WorkflowTabPlaces`, W13); from a workflow, to the row of the one opened last (`ItemNavigation.lastOpenedId`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useCommands } from '@/commands/useCommands.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { getRepositorySettingsPath } from '@/tracking/trackingRoutes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import type { RepositoryWorkflowList } from './buildRepositoryWorkflows.js';
import RepositoryWorkflowsView from './RepositoryWorkflowsView.vue';
import { useAnyRefRead } from './useAnyRefRead.js';
import { useOpenWorkflowRun } from './useOpenWorkflowRun.js';
import { useRunWorkflowCommand } from './useRunWorkflowCommand.js';
import * as l from './RepositoryWorkflowsTab.loc.js';
import { getWorkflowFile } from './utils/getWorkflowFile.js';
import { WorkflowRoutes } from './workflowRoutes.js';
import type { WorkflowReference } from './workflowRoutes.js';
import { WorkflowRunRoutes } from './workflowRunRoutes.js';
import { WorkflowRunStore } from './WorkflowRunStore.js';
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
const repositories = useService(RepositoryStore);
const runStore = useService(WorkflowRunStore);
const route = useRoute();
const router = useRouter();
const openRun = useOpenWorkflowRun();
const runWorkflowCommands = useRunWorkflowCommand();
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
/** The run open in the panel over the section; `null` with none, or one of another repository. */
const openedRun = computed(() => {
  const opened = WorkflowRunRoutes.getOpened(route);
  if (!opened || opened.onPage) {
    return null;
  }

  const { owner, name, runId } = opened.reference;
  return `${owner}/${name}`.toLowerCase() === props.nameWithOwner.toLowerCase() ? runId : null;
});
/**
 * The key of the row whose workflow is open in the panel — or whose run is, `null` until the run is known —; `null`
 * with none, or one of another repository.
 */
const openedKey = computed(() => {
  if (openedRun.value !== null) {
    return findRunRow(openedRun.value);
  }

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

// "Run workflow · Deploy" for the selected row (the first until moved) — with a run in the panel, its workflow's —; the
// workflow open in the panel offers its own.
useCommands(() => {
  const rows = props.list.groups.flatMap(group => group.rows);
  const row = rows.find(candidate => candidate.key === selected.value) ?? rows[0];
  const command =
    row && (openedKey.value === null || openedRun.value !== null)
      ? runWorkflowCommands.forWorkflow({
          nameWithOwner: props.nameWithOwner,
          state: row.workflow,
          id: 'workflows.run',
          kind: 'selected',
        })
      : null;
  return command ? [command] : [];
});

// Whether the user may run a workflow here (write access, archived) decides "Run workflow": read when it isn't known or
// is old.
watch(
  () => props.nameWithOwner,
  nameWithOwner => void repositories.ensure(nameWithOwner),
  { immediate: true },
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

/** The key of the row of the run's workflow; `null` while the run isn't known, or its workflow isn't listed. */
function findRunRow(runId: number) {
  const { run } = runStore.getRun(props.nameWithOwner, runId);
  if (!run) {
    return null;
  }

  for (const group of props.list.groups) {
    for (const row of group.rows) {
      if (row.workflow.workflow.id === run.workflowId) {
        return row.key;
      }
    }
  }

  return null;
}

/** In the panel beside the section when it fits — in place of the workflow or run open there —, else on its page. */
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
  void (openedKey.value === null && openedRun.value === null ? router.push(location) : router.replace(location));
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
    :run-open="openedRun !== null"
    @open="openWorkflow"
    @expand="expandWorkflow"
    @full-screen="openFullScreen"
    @open-run="openRun({ nameWithOwner, run: $event, where: navigation.panelFits ? 'panel' : 'page' })"
    @settings="openSettings"
    @open-on-git-hub="browser.openInNewTab($event)"
  />
</template>
