<!-- A repository's Workflows section (actions W3a–W3e, W13, W14, D7): every workflow, one row each (`WorkflowRow`), under Broken — the newest break first —, Pull requests only, No alerts, Passing, Not known yet and Disabled, each while it has rows; above them the Alerts bar (`WorkflowAlertsBar`). While runs are still being read the groups say "so far", and a workflow not read yet has an empty strip and no verdict (W3c). Before the first read, ghost workflow rows stand in their place (`WorkflowsArriving`, first run and loading D17). With no workflows, or none GitHub shows, an empty state says why (W3d, W3e), with a way to GitHub (O); the rows last read stay below the latter. One workflow at a time unfolds in place, its runs under its row (W3b, `UnfoldedWorkflowRuns`). Keys while it is shown and no layer is open, never from a field — it takes the focus as it opens: J/K and ↓/↑ move the selection — on the first row until moved, through an unfolded workflow's runs —, Enter or a click opens a broken workflow's latest failed run and unfolds any other, opens a run, or asks again after a failed read; → unfolds the selected workflow, ← folds, Esc clears the ref filter, then folds; P opens the repository's alert settings. -->
<script lang="ts" setup>
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import Reveal from '@nzyme/vue/components/Reveal.vue';
import { Github, PackageOpen, PowerOff } from 'lucide-vue-next';
import { computed, onMounted, useTemplateRef } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import { getGitHubUrl, getRepositoryPath, getRepositorySettingsPath } from '@/tracking/trackingRoutes.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import type {
  RepositoryWorkflowEntry,
  RepositoryWorkflowGroup,
  RepositoryWorkflowList,
} from './buildRepositoryWorkflows.js';
import type { UnfoldedRun, UnfoldedWorkflow } from './buildUnfoldedWorkflow.js';
import * as l from './RepositoryWorkflowsView.loc.js';
import UnfoldedWorkflowRuns from './UnfoldedWorkflowRuns.vue';
import WorkflowAlertsBar from './WorkflowAlertsBar.vue';
import WorkflowEmptyState from './WorkflowEmptyState.vue';
import WorkflowRow from './WorkflowRow.vue';
import WorkflowsArriving from './WorkflowsArriving.vue';

const props = withDefaults(
  defineProps<{
    /** `owner/name`. */
    nameWithOwner: string;
    list: RepositoryWorkflowList;
    /** Epoch ms the ages are counted to. */
    now: number;
    /** The workflow unfolded, with its runs; `null` with none. */
    unfolded?: UnfoldedWorkflow | null;
  }>(),
  { unfolded: null },
);

const emit = defineEmits<{
  /** Enter or a click on a broken workflow (its latest failed run) or on a run: the caller opens the run. */
  openRun: [run: GitHubWorkflowRun];
  /** The workflow to unfold, by its row's key; `null` folds the one unfolded. */
  unfold: [key: string | null];
  /** The unfolded workflow's runs filtered by a ref; `null`: every ref. */
  filter: [ref: string | null];
  /** The unfolded workflow's end came into view, or its failed read is asked again: the caller reads older runs. */
  readMore: [];
  /**
   * P or "Alert settings": the caller opens the repository's settings on Workflow alerts — on its add field when P is
   * pressed on a workflow failing only where nothing raises alerts (W13).
   */
  settings: [addPattern: boolean];
  /** O or the empty state's button: the caller opens this address of GitHub's. */
  openOnGitHub: [url: string];
}>();

/** The selected row's key; `null` until the user moves, the first row being selected. */
const selected = defineModel<string | null>('selected', { default: null });

const t = useTranslate();
const root = useTemplateRef('root');

/** The key of the line under an unfolded workflow that asks again after a failed read. */
const RETRY_KEY = 'retry';

/** What the keys move through: the workflows' rows, and the unfolded one's runs and failed read under its row. */
type TabRow =
  | { readonly kind: 'workflow'; readonly key: string; readonly entry: RepositoryWorkflowEntry }
  | { readonly kind: 'run'; readonly key: string; readonly run: GitHubWorkflowRun }
  | { readonly kind: 'retry'; readonly key: string };

const rows = computed(() =>
  props.list.groups.flatMap(group =>
    group.rows.flatMap((entry): TabRow[] => {
      const row: TabRow = { kind: 'workflow', key: entry.key, entry };
      const { unfolded } = props;
      if (unfolded?.key !== entry.key) {
        return [row];
      }

      const unfoldedRows: TabRow[] = [row];
      for (const line of unfolded.runs) {
        unfoldedRows.push({ kind: 'run', key: line.key, run: line.run });
      }

      if (unfolded.status === 'failed') {
        unfoldedRows.push({ kind: 'retry', key: RETRY_KEY });
      }

      return unfoldedRows;
    }),
  ),
);
// A row gone (a workflow removed on GitHub, a run filtered out) or moved to another group: the selection follows it,
// or its neighbour.
const selection = useRowSelection({
  rows,
  getKey: row => row.key,
  root,
  keyAttribute: 'data-workflow-key',
  selectFirst: true,
  chosenKey: selected,
  open: openSelected,
});
/** What the screen says in place of rows, or above the last known ones; `null` with rows and nothing to explain, or while the first read runs. */
const emptyState = computed(() => {
  const { list, nameWithOwner } = props;
  const actionsUrl = getGitHubUrl(getRepositoryPath(nameWithOwner, 'workflows'));
  switch (list.status) {
    case 'unread':
      return null;
    case 'unavailable':
      return list.unavailable?.reason === 'disabled'
        ? {
            icon: PowerOff,
            title: t(l.actionsOffTitle),
            text: t(l.actionsOffText, { name: nameWithOwner }),
            detail: t(l.actionsOffDetail),
            action: {
              label: t(l.openActionsSettings),
              url: getGitHubUrl(`${getRepositorySettingsPath(nameWithOwner)}/actions`),
            },
          }
        : {
            icon: PowerOff,
            title: t(l.refusedTitle, { status: list.unavailable?.status ?? '' }),
            text: t(l.refusedText, { name: nameWithOwner }),
            detail: t(l.refusedDetail, { status: list.unavailable?.status ?? '' }),
            action: { label: t(l.openOnGitHub), url: actionsUrl },
          };
    case 'read':
      return list.groups.length === 0
        ? {
            icon: PackageOpen,
            title: t(l.noWorkflowsTitle),
            text: t(l.noWorkflowsText, { name: nameWithOwner }),
            detail: t(l.noWorkflowsDetail),
            action: { label: t(l.openOnGitHub), url: actionsUrl },
          }
        : null;
    default:
      return assertNever(list.status);
  }
});

useCommands(() => [
  { id: 'workflows.next', title: t(l.next), section: 'view', key: 'J', otherKeys: ['ArrowDown'], menu: false },
  { id: 'workflows.previous', title: t(l.previous), section: 'view', key: 'K', otherKeys: ['ArrowUp'], menu: false },
  { id: 'workflows.open', title: t(l.open), section: 'view', key: 'Enter', menu: false },
  {
    id: 'workflows.otherRuns',
    title: t(l.otherRuns),
    section: 'view',
    key: 'ArrowRight',
    menu: false,
    actsOnRow: true,
    when: () => selection.selectedRow?.kind === 'workflow' && props.unfolded?.key !== selection.selectedRow.key,
    run: () => {
      if (selection.selectedRow?.kind === 'workflow') {
        emit('unfold', selection.selectedRow.key);
      }
    },
  },
  {
    id: 'workflows.fold',
    title: t(l.fold),
    section: 'view',
    key: 'ArrowLeft',
    menu: false,
    actsOnRow: true,
    when: () => props.unfolded !== null,
    run: fold,
  },
  // With a ref filter set, Esc clears it first (`UnfoldedWorkflowRuns`).
  {
    id: 'workflows.foldOnEscape',
    title: t(l.fold),
    section: 'view',
    key: 'Escape',
    menu: false,
    actsOnRow: true,
    when: () => props.unfolded !== null && props.unfolded.ref === null,
    run: fold,
  },
  {
    id: 'workflows.alertSettings',
    title: t(l.alertSettings),
    section: 'view',
    key: 'P',
    actsOnRow: true,
    when: () => props.list.status === 'read' && props.list.groups.length > 0,
    run: () => {
      const row = selection.selectedRow;
      emit('settings', row?.kind === 'workflow' && row.entry.standing?.kind === 'noAlerts');
    },
  },
  {
    id: 'workflows.openOnGitHub',
    title: emptyState.value?.action?.label ?? t(l.openOnGitHub),
    section: 'view',
    key: 'O',
    actsOnRow: true,
    when: () => emptyState.value?.action != null,
    run: () => {
      const action = emptyState.value?.action;
      if (action) {
        emit('openOnGitHub', action.url);
      }
    },
  },
]);

// Arrived from a tab or the menu, the keys are the screen's: Enter no longer presses what was clicked.
onMounted(() => {
  root.value?.focus({ preventScroll: true });
  // Back on a row the user had moved to: it is in sight again.
  if (selected.value !== null) {
    selection.reveal();
  }
});

function openRow(entry: RepositoryWorkflowEntry) {
  selection.select(entry.key);
  openWorkflow(entry);
}

function openSelected(row: TabRow) {
  switch (row.kind) {
    case 'workflow':
      openWorkflow(row.entry);
      return;
    case 'run':
      emit('openRun', row.run);
      return;
    case 'retry':
      emit('readMore');
      return;
    default:
      assertNever(row);
  }
}

/** A broken workflow opens its latest failed run; any other unfolds. */
function openWorkflow(entry: RepositoryWorkflowEntry) {
  const run = entry.workflow.state === 'broken' ? entry.workflow.latestFailedRun : null;
  if (run) {
    emit('openRun', run);
  } else {
    emit('unfold', entry.key);
  }
}

function openLine(line: UnfoldedRun) {
  selection.select(line.key);
  emit('openRun', line.run);
}

/** Folds the unfolded workflow, its row selected. */
function fold() {
  if (props.unfolded) {
    selection.select(props.unfolded.key);
    emit('unfold', null);
  }
}

function describeGroup(group: RepositoryWorkflowGroup) {
  const soFar = props.list.reading ? t(l.soFar) : null;
  switch (group.kind) {
    case 'broken':
      return { label: t(l.broken), note: soFar };
    case 'pullRequestsOnly':
      return { label: t(l.pullRequestsOnly), note: t(l.pullRequestsOnlyNote) };
    case 'noAlerts':
      return { label: t(l.noAlerts), note: t(props.list.alertsOff ? l.noAlertsOffNote : l.noAlertsNote) };
    case 'passing':
      return { label: t(l.passing), note: soFar };
    case 'notKnown':
      return { label: t(l.notKnown), note: null };
    case 'disabled':
      return { label: t(l.disabled), note: t(l.disabledNote) };
    default:
      return assertNever(group.kind);
  }
}
</script>

<template>
  <div
    ref="root"
    :class="css.repositoryWorkflowsView"
    tabindex="-1"
  >
    <WorkflowAlertsBar
      v-if="list.status === 'read' && list.groups.length > 0"
      :alerts="list.alerts"
      :alerts-off="list.alertsOff"
      @settings="emit('settings', false)"
    />

    <div
      :class="css.repositoryWorkflowsView_body"
      :data-route-scroll="`repository-workflows:${nameWithOwner}`"
    >
      <WorkflowsArriving v-if="list.status === 'unread'" />
      <div
        v-else-if="emptyState"
        :class="[
          css.repositoryWorkflowsView_message,
          list.groups.length > 0 && css.repositoryWorkflowsView_message_above,
        ]"
      >
        <WorkflowEmptyState
          :icon="emptyState.icon"
          :title="emptyState.title"
          :text="emptyState.text"
          :detail="emptyState.detail"
        >
          <template
            v-if="emptyState.action"
            #actions
          >
            <Button
              variant="secondary"
              size="sm"
              :icon="Github"
              kbd="O"
              keyshortcuts="O"
              @click="emit('openOnGitHub', emptyState.action.url)"
            >
              {{ emptyState.action.label }}
            </Button>
          </template>
        </WorkflowEmptyState>
      </div>

      <section
        v-for="group in list.groups"
        :key="group.kind"
        :aria-label="describeGroup(group).label"
        data-screen-keys
      >
        <h2 :class="css.repositoryWorkflowsView_group">
          {{ describeGroup(group).label }}
          <span :class="css.repositoryWorkflowsView_count">{{ group.rows.length }}</span>
          <span
            v-if="describeGroup(group).note"
            :class="css.repositoryWorkflowsView_note"
            >{{ describeGroup(group).note }}</span
          >
        </h2>
        <template
          v-for="row in group.rows"
          :key="row.key"
        >
          <WorkflowRow
            :data-workflow-key="row.key"
            :workflow="row.workflow"
            :name-with-owner="nameWithOwner"
            :now="now"
            :git-ref="row.gitRef"
            :more-ref-count="row.moreRefCount"
            :standing="row.standing"
            :runs="row.runs"
            :selected="row.key === selection.selectedKey"
            :expanded="row.workflow.state === 'broken' ? null : unfolded?.key === row.key"
            @open="openRow(row)"
          />
          <Reveal>
            <UnfoldedWorkflowRuns
              v-if="unfolded?.key === row.key"
              key="runs"
              :name="row.workflow.workflow.name"
              :unfolded="unfolded"
              :now="now"
              :selected-key="selection.selectedKey"
              :retry-key="RETRY_KEY"
              @filter="emit('filter', $event)"
              @open-run="openLine"
              @read-more="emit('readMore')"
            />
          </Reveal>
        </template>
      </section>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.repositoryWorkflowsView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;

  // Focused only to take the keys from where the user came from; it is not a control.
  &:focus {
    outline: none;
  }
}

.repositoryWorkflowsView_body {
  flex: 1;
  min-height: 0;
  padding-bottom: $spacing-16;
  overflow-y: auto;
}

.repositoryWorkflowsView_message {
  display: flex;
  justify-content: center;
  padding: $spacing-96 $spacing-16 $spacing-48;
}

// The last known rows follow: the message keeps less room above them.
.repositoryWorkflowsView_message_above {
  padding: $spacing-48 $spacing-16 $spacing-32;
  border-bottom: 1px solid $color-border;
}

.repositoryWorkflowsView_group {
  display: flex;
  gap: $spacing-7;
  align-items: center;
  padding: $spacing-10 $spacing-16 $spacing-6;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.repositoryWorkflowsView_count {
  font-family: $font-family-mono;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.repositoryWorkflowsView_note {
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}
</style>
