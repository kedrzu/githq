<!-- A repository's Workflows tab (actions W3a, W3c–W3e, W13, W14, D7): every workflow, one row each (`WorkflowRow`), under Broken — the newest break first —, Pull requests only, No alerts, Passing, Not known yet and Disabled, each while it has rows; above them the Alerts bar (`WorkflowAlertsBar`). While runs are still being read the groups say "so far", and a workflow not read yet has an empty strip and no verdict (W3c). With no workflows, or none GitHub shows, an empty state says why (W3d, W3e), with a way to GitHub (O); the rows last read stay below the latter. Keys while it is shown and no layer is open, never from a field — it takes the focus as it opens: J/K and ↓/↑ move the selection — on the first row until moved —, Enter opens the selected workflow as a click on its row does, P opens the repository's alert settings. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleDashed, Github, PackageOpen, PowerOff } from 'lucide-vue-next';
import { computed, onMounted, useTemplateRef } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import { GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import type {
  RepositoryWorkflowEntry,
  RepositoryWorkflowGroup,
  RepositoryWorkflowList,
} from './buildRepositoryWorkflows.js';
import * as l from './RepositoryWorkflowsView.loc.js';
import WorkflowAlertsBar from './WorkflowAlertsBar.vue';
import WorkflowEmptyState from './WorkflowEmptyState.vue';
import WorkflowRow from './WorkflowRow.vue';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  list: RepositoryWorkflowList;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** Enter or a click on a row: the caller opens a broken workflow's latest failed run, or the workflow. */
  open: [entry: RepositoryWorkflowEntry];
  /** P or "Alert settings": the caller opens the repository's settings on Workflow alerts. */
  settings: [];
  /** O or the empty state's button: the caller opens this address of GitHub's. */
  openOnGitHub: [url: string];
}>();

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
  open: row => emit('open', row),
});
/** What the screen says in place of rows, or above the last known ones; `null` with rows and nothing to explain. */
const emptyState = computed(() => {
  const { list, nameWithOwner } = props;
  const actionsUrl = `${GITHUB_ORIGIN}/${nameWithOwner}/actions`;
  switch (list.status) {
    case 'unread':
      return {
        icon: CircleDashed,
        title: t(l.notReadTitle),
        text: t(l.notReadText, { name: nameWithOwner }),
        detail: null,
        action: null,
      };
    case 'unavailable':
      return list.unavailable?.reason === 'disabled'
        ? {
            icon: PowerOff,
            title: t(l.actionsOffTitle),
            text: t(l.actionsOffText, { name: nameWithOwner }),
            detail: t(l.actionsOffDetail),
            action: { label: t(l.openActionsSettings), url: `${GITHUB_ORIGIN}/${nameWithOwner}/settings/actions` },
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
    id: 'workflows.alertSettings',
    title: t(l.alertSettings),
    section: 'view',
    key: 'P',
    when: () => props.list.status === 'read' && props.list.groups.length > 0,
    run: () => emit('settings'),
  },
  {
    id: 'workflows.openOnGitHub',
    title: emptyState.value?.action?.label ?? t(l.openOnGitHub),
    section: 'view',
    key: 'O',
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
onMounted(() => root.value?.focus({ preventScroll: true }));

function openRow(row: RepositoryWorkflowEntry) {
  selection.select(row.key);
  emit('open', row);
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
      @settings="emit('settings')"
    />

    <div :class="css.repositoryWorkflowsView_body">
      <div
        v-if="emptyState"
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
              aria-keyshortcuts="O"
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
          :now="now"
          :git-ref="row.gitRef"
          :more-ref-count="row.moreRefCount"
          :standing="row.standing"
          :runs="row.runs"
          :selected="row.key === selection.selectedKey"
          @open="openRow(row)"
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

.repositoryWorkflowsView_message {
  display: flex;
  justify-content: center;
  padding: 96px $spacing-16 48px;
}

// The last known rows follow: the message keeps less room above them.
.repositoryWorkflowsView_message_above {
  padding: 48px $spacing-16 32px;
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
