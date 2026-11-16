<!-- A repository's Workflows section (actions W3a–W3e, W13, W14, W35, D7, D15): every workflow, one row each (`WorkflowRow`), under Broken — the newest break first —, Pull requests only, No alerts, Passing, Not known yet and Disabled, each while it has rows; above them the Alerts bar (`WorkflowAlertsBar`). While runs are still being read the groups say "so far", and a workflow not read yet has an empty strip and no verdict (W3c). Before the first read, ghost workflow rows stand in their place (`WorkflowsArriving`, first run and loading D17). With no workflows, or none GitHub shows, an empty state says why (W3d, W3e), with a way to GitHub (O); the rows last read stay below the latter. Keys while it is shown and no layer is open, never from a field — it takes the focus as it opens: J/K and ↓/↑ move the selection — on the first row until moved; with a workflow open in the panel the selection is that workflow's row, and moving it opens the next one in its place —, Enter or a click opens the workflow, the one open expands to full screen; ⇧Enter opens it full screen straight (the open one's is the item's own key); F opens its latest failed run on any ref, nothing without one; P opens the repository's alert settings. With a run open in the panel the selection is its workflow's row and J/K, ↓/↑, Enter, ⇧Enter and F are the run's; a click on a row opens that workflow in the run's place. -->
<script lang="ts" setup>
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Github, PackageOpen, PowerOff } from 'lucide-vue-next';
import { computed, onMounted, useTemplateRef, watch } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import { openOnGitHub } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { getGitHubUrl, getRepositoryPath, getRepositorySettingsPath } from '@/tracking/trackingRoutes.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import type { RepositoryWorkflowGroup, RepositoryWorkflowList } from './buildRepositoryWorkflows.js';
import * as l from './RepositoryWorkflowsView.loc.js';
import WorkflowAlertsBar from './WorkflowAlertsBar.vue';
import WorkflowRow from './WorkflowRow.vue';
import WorkflowsArriving from './WorkflowsArriving.vue';

const props = withDefaults(
  defineProps<{
    /** `owner/name`. */
    nameWithOwner: string;
    list: RepositoryWorkflowList;
    /** Epoch ms the ages are counted to. */
    now: number;
    /**
     * The key of the row whose workflow is open in the panel beside the section — or whose run is, with `runOpen` —;
     * `null` with none.
     */
    openedKey?: string | null;
    /**
     * Whether a run is open in the panel: its keys win, so the list's J/K, ↓/↑, Enter, ⇧Enter and F are off and the
     * selection stays on the run's workflow.
     */
    runOpen?: boolean;
  }>(),
  { openedKey: null, runOpen: false },
);

const emit = defineEmits<{
  /** Enter or a click on a row not open: the caller opens its workflow, by the row's key — in the panel when it fits. */
  open: [key: string];
  /** Enter or a click on the row open in the panel: the caller expands it to full screen. */
  expand: [key: string];
  /** ⇧Enter on a row not open: the caller opens its workflow full screen straight. */
  fullScreen: [key: string];
  /** F or "Open latest failure": the caller opens the selected workflow's latest failed run. */
  openRun: [run: GitHubWorkflowRun];
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

const rows = computed(() => props.list.groups.flatMap(group => group.rows));
// A row gone (a workflow removed on GitHub) or moved to another group: the selection follows it, or its neighbour.
const selection = useRowSelection({
  rows,
  getKey: row => row.key,
  root,
  keyAttribute: 'data-workflow-key',
  selectFirst: true,
  chosenKey: selected,
  open: row => openKey(row.key),
  // With a run in the panel these keys are the run's.
  enabled: () => !props.runOpen,
  place: 'workflows',
  openTitle: l.open,
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
            action: { label: t(openOnGitHub.title), url: actionsUrl },
          };
    case 'read':
      return list.groups.length === 0
        ? {
            icon: PackageOpen,
            title: t(l.noWorkflowsTitle),
            text: t(l.noWorkflowsText, { name: nameWithOwner }),
            detail: t(l.noWorkflowsDetail),
            action: { label: t(openOnGitHub.title), url: actionsUrl },
          }
        : null;
    default:
      return assertNever(list.status);
  }
});

useCommands(() => [
  // On the row open in the panel, ⇧Enter is the opened item's own (back and forth between the panel and its page).
  {
    id: 'workflows.fullScreen',
    title: t(l.openFullScreen),
    section: 'view',
    key: 'Shift+Enter',
    actsOnRow: true,
    when: () => !props.runOpen && selection.selectedKey !== null && selection.selectedKey !== props.openedKey,
    run: () => {
      if (selection.selectedKey !== null) {
        emit('fullScreen', selection.selectedKey);
      }
    },
  },
  {
    id: 'workflows.latestFailure',
    title: t(l.openLatestFailure),
    section: 'view',
    key: 'F',
    actsOnRow: true,
    when: () => !props.runOpen && selection.selectedRow?.latestFailure != null,
    run: () => {
      const run = selection.selectedRow?.latestFailure;
      if (run) {
        emit('openRun', run);
      }
    },
  },
  {
    id: 'workflows.alertSettings',
    title: t(l.alertSettings),
    section: 'view',
    key: 'P',
    actsOnRow: true,
    when: () => props.list.status === 'read' && props.list.groups.length > 0,
    run: () => emit('settings', selection.selectedRow?.standing?.kind === 'noAlerts'),
  },
  bindCommand(
    openOnGitHub,
    {
      place: 'workflows',
      section: 'view',
      actsOnRow: true,
      when: () => emptyState.value?.action != null,
      run: () => {
        const action = emptyState.value?.action;
        if (action) {
          emit('openOnGitHub', action.url);
        }
      },
    },
    t,
  ),
]);

// The workflow open in the panel is the selected row — also one the address opens as the page loads (a reload).
watch(
  () => props.openedKey,
  key => {
    if (key !== null) {
      selection.select(key);
    }
  },
  { immediate: true },
);
// With a workflow open in the panel, the selection moving opens the next one in its place; a run there stays.
watch(
  () => selection.selectedKey,
  key => {
    if (!props.runOpen && key !== null && props.openedKey !== null && key !== props.openedKey) {
      emit('open', key);
    }
  },
);

// Arrived from a tab or the menu, the keys are the screen's: Enter no longer presses what was clicked.
onMounted(() => {
  root.value?.focus({ preventScroll: true });
  // Back on a row the user had moved to: it is in sight again.
  if (selected.value !== null) {
    selection.reveal();
  }
});

/**
 * A click on a row: selected, and opened — with a workflow open in the panel, selecting it opens it in its place; with
 * a run there, the row's workflow opens in the run's place.
 */
function openRow(key: string) {
  const moved = key !== selection.selectedKey;
  selection.select(key);
  if (props.runOpen || !moved || props.openedKey === null) {
    openKey(key);
  }
}

/** The row whose workflow is open in the panel expands to full screen; any other opens — the run's workflow's too. */
function openKey(key: string) {
  if (key === props.openedKey && !props.runOpen) {
    emit('expand', key);
  } else {
    emit('open', key);
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
      :class="[
        css.repositoryWorkflowsView_body,
        emptyState && list.groups.length === 0 && css.repositoryWorkflowsView_body_note,
      ]"
      :data-route-scroll="`repository-workflows:${nameWithOwner}`"
    >
      <WorkflowsArriving v-if="list.status === 'unread'" />
      <EmptyState
        v-else-if="emptyState"
        :class="list.groups.length > 0 && css.repositoryWorkflowsView_noteAbove"
        :icon="emptyState.icon"
        :title="emptyState.title"
        :detail="emptyState.text"
        :fact="emptyState.detail"
      >
        <template
          v-if="emptyState.action"
          #action
        >
          <Button
            variant="secondary"
            size="sm"
            :icon="Github"
            :kbd="keyOf(openOnGitHub)"
            :keyshortcuts="keyOf(openOnGitHub)"
            @click="emit('openOnGitHub', emptyState.action.url)"
          >
            {{ emptyState.action.label }}
          </Button>
        </template>
      </EmptyState>

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
        <WorkflowRow
          v-for="row in group.rows"
          :key="row.key"
          :data-workflow-key="row.key"
          :workflow="row.workflow"
          :name-with-owner="nameWithOwner"
          :now="now"
          :git-ref="row.gitRef"
          :more-ref-count="row.moreRefCount"
          :standing="row.standing"
          :runs="row.runs"
          :selected="row.key === selection.selectedKey"
          @open="openRow(row.key)"
        />
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

// The last known rows follow the note.
.repositoryWorkflowsView_noteAbove {
  flex: none;
  border-bottom: 1px solid $color-border;
}

.repositoryWorkflowsView_body_note {
  display: flex;
  flex-direction: column;
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
