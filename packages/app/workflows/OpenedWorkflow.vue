<!-- The workflow an address opens, in its arrangement (actions D15): found among the repository's workflows and kept current (`useOpenedWorkflow`, which reads its runs' first page and its file as it opens), shown in the workflow view — in the panel beside the Workflows section or on its page — and moved as any opened item is (`useItemArrangement`): "Open full screen" (`⇧Enter`) expands it from the panel, Escape goes back the way it came — the list selecting the workflow opened last (`ItemNavigation.lastOpenedId`, by its key), or with no list behind it (opened by its address) up to the repository's Workflows section —, `⇧K`/`⇧J` step through the list of workflows it was opened from, by their keys (`WorkflowRoutes.formatKey`). A run opens in its place in the panel when the workflow is there, else on its page, Back (and Esc from the run in the panel) returning here on that run (the selected run is kept per workflow for the session, `WorkflowTabPlaces`); the filters and the grouping set there go to the run history and the settings. "Run workflow", offered with write access to a repository that isn't archived for an enabled workflow of its own, opens the command menu at its form (`useRunWorkflowCommand`). By the same gate ⌘K disables the workflow, or enables it beside its dimmed "Run workflow", and re-runs all the jobs of the run under the cursor full screen or cancels it while it goes (`WorkflowRunStore`, no key: D10); it also opens the workflow's file at the default branch on GitHub — not for one GitHub generates — and copies the workflow's link. Until the repository's workflows are read it says it is opening; once read, a workflow not among them is said missing. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { ArrowLeft, CirclePause, CirclePlay, SearchX } from 'lucide-vue-next';
import { computed, watch } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { copyLink, openWorkflowFile, toggleWorkflow } from '@/commands/definitions/index.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import type { ItemArrangement } from '@/item/itemRoutes.js';
import { useItemArrangement } from '@/item/useItemArrangement.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { useNow } from '@/services/useNow.js';
import { getGitHubUrl, getRepositoryPath } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import * as l from './OpenedWorkflow.loc.js';
import { useOpenedWorkflow } from './useOpenedWorkflow.js';
import { useOpenWorkflowRun } from './useOpenWorkflowRun.js';
import { useRunWorkflowCommand } from './useRunWorkflowCommand.js';
import { getDispatchBlock } from './utils/getDispatchBlock.js';
import { getRepositoryDispatchBlock } from './utils/getRepositoryDispatchBlock.js';
import { WorkflowRunHistory } from './WorkflowRunHistory.js';
import { WorkflowRunStore } from './WorkflowRunStore.js';
import type { WorkflowRunTarget } from './WorkflowRunStore.js';
import { WorkflowStore } from './WorkflowStore.js';
import { WorkflowTabPlaces } from './WorkflowTabPlaces.js';
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
const places = useService(WorkflowTabPlaces);
const registry = useService(CommandRegistry);
const repositories = useService(RepositoryStore);
const runStore = useService(WorkflowRunStore);
const browser = useService(Browser);
const workflows = useService(WorkflowStore);
const runWorkflowCommands = useRunWorkflowCommand();
const now = useNow(TICK_MS);
const openRun = useOpenWorkflowRun();

const opened = useOpenedWorkflow({ reference: () => props.reference });
const arranging = useItemArrangement({
  routes: WorkflowRoutes,
  reference: () => props.reference,
  arrangement: () => props.arrangement,
  // Its key among the steps of a list of workflows: found once it is among the repository's workflows.
  id: () => (opened.state ? WorkflowRoutes.formatKey(props.reference) : null),
  // With no list behind it, closing goes up to its repository's Workflows section.
  parent: () => ({ path: getRepositoryPath(opened.nameWithOwner, 'workflows'), title: opened.nameWithOwner }),
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

// What the user may do there (write access, archived) decides what is offered: read when it isn't known or is old.
watch(
  () => opened.nameWithOwner,
  nameWithOwner => void repositories.ensure(nameWithOwner),
  { immediate: true },
);

/** Re-running, cancelling and turning it off or on go by the same gate as re-running a run's failed jobs. */
const canChangeRuns = computed(() => getRepositoryDispatchBlock(repositories.get(opened.nameWithOwner)) === null);
/** "Disable workflow" or "Enable workflow", whichever it isn't; `null` where neither is offered. */
const toggle = computed(() => {
  const state = opened.state?.workflow.state;
  if (!canChangeRuns.value || state === undefined || state === 'deleted') {
    return null;
  }

  return state === 'active' ? 'disable' : 'enable';
});

/** "Run workflow · Deploy" for the workflow open: what its Run workflow button opens the command menu at too. */
const runCommand = computed(() =>
  opened.state
    ? runWorkflowCommands.forWorkflow({ nameWithOwner: opened.nameWithOwner, state: opened.state, place: 'workflow' })
    : null,
);

// None of these has a key: turning a workflow off is never one stray keystroke away (D10).
useCommands(() => {
  const { state } = opened;
  if (!state) {
    return [];
  }

  const { workflow } = state;
  const defaultBranch = workflows.get(opened.nameWithOwner)?.defaultBranch ?? null;
  const commands: BoundCommand[] = runCommand.value ? [runCommand.value] : [];
  if (toggle.value) {
    const enabling = toggle.value === 'enable';
    commands.push(
      bindCommand(
        toggleWorkflow,
        {
          section: 'view',
          title: enabling ? t(l.enable) : t(l.disable),
          icon: enabling ? CirclePlay : CirclePause,
          detail: enabling ? t(l.enableDetail) : t(l.disableDetail),
          run: () => setEnabled(enabling),
        },
        t,
      ),
    );
  }

  commands.push(
    bindCommand(
      openWorkflowFile,
      {
        section: 'view',
        detail: workflow.path,
        unavailable: state.generated ? t(l.generated) : undefined,
        run: () =>
          browser.openInNewTab(
            defaultBranch === null
              ? workflow.htmlUrl
              : getGitHubUrl(encodeURI(`${opened.nameWithOwner}/blob/${defaultBranch}/${workflow.path}`)),
          ),
      },
      t,
    ),
    bindCommand(
      copyLink,
      {
        place: 'workflow',
        section: 'view',
        title: t(l.copyLink),
        run: () => void navigator.clipboard.writeText(workflow.htmlUrl),
      },
      t,
    ),
  );
  return commands;
});

/** "Run workflow" is offered where the user may run it and GitHub may run it by hand: the file decides the rest. */
const offerRun = computed(
  () =>
    opened.state !== null &&
    getDispatchBlock({
      workflow: opened.state.workflow,
      generated: opened.state.generated,
      metadata: repositories.get(opened.nameWithOwner),
      parse: null,
    }) === null,
);

/** The run selected among its runs, kept for the session so coming back from a run's page lands on it. */
const selectedRun = computed({
  get: () => places.getRunSelected(WorkflowRoutes.formatKey(props.reference)),
  set: (runKey: string | null) => places.setRunSelected(WorkflowRoutes.formatKey(props.reference), runKey),
});
const referenceText = computed(() => `${opened.nameWithOwner} ${props.reference.file}`);

function setEnabled(enabled: boolean) {
  if (opened.state) {
    runStore.setEnabled({ nameWithOwner: opened.nameWithOwner, workflowId: opened.state.workflow.id, enabled });
  }
}

/** A run of the list as the store takes it: the list's runs don't carry their workflow's name. */
function getRunTarget(run: GitHubWorkflowRun): WorkflowRunTarget {
  return {
    nameWithOwner: opened.nameWithOwner,
    run: { ...run, workflowName: opened.state?.workflow.name ?? null, headCommitMessage: null },
  };
}

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
    v-model:selected-run="selectedRun"
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
    :escape-to="arranging.closesToPanel ? 'panel' : 'list'"
    :offer-run="offerRun"
    :offer-toggle="toggle !== null"
    :can-change-runs="canChangeRuns"
    :now="now"
    @close="arranging.close()"
    @previous="arranging.step(-1)"
    @next="arranging.step(1)"
    @arrange="arranging.arrange($event)"
    @open-run="openRun({ nameWithOwner: opened.nameWithOwner, run: $event, where: arrangement })"
    @filter="setFilters"
    @read-more="readMore"
    @group-by="tracking.setWorkflowRunsGroupBy($event)"
    @run-workflow="registry.openMenu(runCommand?.id ?? null)"
    @rerun-all="runStore.rerunAll(getRunTarget($event))"
    @cancel="runStore.cancel(getRunTarget($event))"
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
