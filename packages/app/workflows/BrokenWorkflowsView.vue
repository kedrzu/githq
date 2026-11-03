<!-- Every broken workflow of the tracked repositories (actions W2): the header with how many are broken in how many repositories, then the rows (`WorkflowRow`, the repository named) under "New" — broken less than a day ago — and "Ongoing", the newest break first, so an old failure cannot hide a fresh one. Repositories not read yet follow under "Not known yet", and nothing claims them healthy; those GitHub shows nothing of under "Can't tell", out of the total (W2c). With nothing broken and everything read, the all-green state says so (W2b). Keys while it is shown and no layer is open, never from a field — it takes the focus as it opens: J/K and ↓/↑ move the selection — on the first row until moved — and Enter opens the selected workflow's latest failed run, as a click on its row does. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Ban, CircleDashed, Coffee, Workflow } from 'lucide-vue-next';
import { computed, onMounted, useTemplateRef } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Kbd from '@/components/Kbd.vue';
import { formatCheckedAge } from '@/utils/formatCheckedAge.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import type { BrokenWorkflowEntry, BrokenWorkflows, UnavailableWorkflowsEntry } from './buildBrokenWorkflows.js';
import * as l from './BrokenWorkflowsView.loc.js';
import RunStrip from './RunStrip.vue';
import WorkflowEmptyState from './WorkflowEmptyState.vue';
import WorkflowRow from './WorkflowRow.vue';

const props = defineProps<{
  broken: BrokenWorkflows;
  /** When the workflows were last polled (epoch ms); `null` before the first poll. */
  checkedAt: number | null;
  /** Epoch ms the ages are counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** Enter or a click on a row: the caller opens the workflow's latest failed run. */
  open: [entry: BrokenWorkflowEntry];
}>();

/** The selected row's key; `null` until the user moves, the first row being selected. */
const selected = defineModel<string | null>('selected', { default: null });

const t = useTranslate();
const root = useTemplateRef('root');

const rows = computed(() => [...props.broken.fresh, ...props.broken.ongoing]);
// A row gone (a workflow passed, a repository untracked): the selection goes to its nearest neighbour.
const selection = useRowSelection({
  rows,
  getKey: row => row.key,
  root,
  keyAttribute: 'data-workflow-key',
  selectFirst: true,
  chosenKey: selected,
  open: row => emit('open', row),
});
/** "New" and "Ongoing", each while it has rows. */
const brokenGroups = computed(() =>
  [
    { key: 'fresh', label: t(l.fresh), note: t(l.freshNote), rows: props.broken.fresh },
    { key: 'ongoing', label: t(l.ongoing), note: null, rows: props.broken.ongoing },
  ].filter(group => group.rows.length > 0),
);
const trackedCount = computed(
  () => props.broken.readCount + props.broken.unread.length + props.broken.unavailable.length,
);
/** Nothing broken and every repository that shows its workflows read: the all-green state. */
const allGreen = computed(() => props.broken.brokenCount === 0 && props.broken.unread.length === 0);
const meta = computed(() => {
  const { brokenCount, brokenRepositoryCount, readCount, unread } = props.broken;
  if (unread.length > 0) {
    return brokenCount > 0
      ? t(l.soFarReading, { broken: brokenCount, count: unread.length })
      : t(l.reading, { count: unread.length });
  }

  return brokenCount > 0
    ? t(l.brokenIn, { broken: brokenCount, repositories: brokenRepositoryCount })
    : t(l.noneIn, { count: readCount });
});
/** Says which repositories the green covers: some GitHub shows nothing of are out of it. */
const allGreenText = computed(() =>
  props.broken.unavailable.length > 0
    ? t(l.allGreenTextPartly, { read: props.broken.readCount, tracked: trackedCount.value })
    : t(l.allGreenText, { count: props.broken.readCount }),
);
const allGreenDetail = computed(() =>
  t(l.allGreenDetail, {
    read: props.broken.readCount,
    tracked: trackedCount.value,
    age: props.checkedAt === null ? '–' : formatCheckedAge(props.checkedAt, props.now),
  }),
);

useCommands(() => [
  { id: 'workflows.next', title: t(l.next), section: 'view', key: 'J', otherKeys: ['ArrowDown'], menu: false },
  { id: 'workflows.previous', title: t(l.previous), section: 'view', key: 'K', otherKeys: ['ArrowUp'], menu: false },
  { id: 'workflows.open', title: t(l.openFailedRun), section: 'view', key: 'Enter', menu: false },
]);

// Arrived from the sidebar or the command menu, the keys are the screen's: Enter no longer follows the link pressed.
onMounted(() => {
  root.value?.focus({ preventScroll: true });
  // Back on a row the user had moved to: it is in sight again.
  if (selected.value !== null) {
    selection.reveal();
  }
});

function openRow(row: BrokenWorkflowEntry) {
  selection.select(row.key);
  emit('open', row);
}

function describeUnavailable(entry: UnavailableWorkflowsEntry) {
  const { reason, status } = entry.unavailable;
  return reason === 'disabled'
    ? { name: t(l.actionsOff), status: t(l.actionsOffStatus) }
    : { name: t(l.actionsRefused), status: t(l.actionsRefusedStatus, { status }) };
}
</script>

<template>
  <div
    ref="root"
    :class="css.brokenWorkflowsView"
    tabindex="-1"
  >
    <header :class="css.brokenWorkflowsView_header">
      <Workflow
        :class="css.brokenWorkflowsView_headerIcon"
        aria-hidden="true"
      />
      <h1 :class="css.brokenWorkflowsView_title">{{ t(l.title) }}</h1>
      <span :class="css.brokenWorkflowsView_meta">{{ meta }}</span>
      <span
        v-if="rows.length > 0"
        :class="css.brokenWorkflowsView_hint"
        aria-hidden="true"
      >
        <Kbd keys="Enter" />
        {{ t(l.openFailedRun) }}
      </span>
    </header>

    <div :class="css.brokenWorkflowsView_body">
      <div
        v-if="allGreen && trackedCount === 0"
        :class="css.brokenWorkflowsView_message"
      >
        <WorkflowEmptyState
          :icon="Workflow"
          :title="t(l.nothingTrackedTitle)"
          :text="t(l.nothingTrackedText)"
        />
      </div>
      <div
        v-else-if="allGreen && broken.readCount > 0"
        :class="css.brokenWorkflowsView_message"
      >
        <WorkflowEmptyState
          :icon="Coffee"
          tone="green"
          :title="t(l.allGreenTitle)"
          :text="allGreenText"
          :detail="allGreenDetail"
        />
      </div>

      <section
        v-for="group in brokenGroups"
        :key="group.key"
        :aria-label="group.label"
      >
        <h2 :class="css.brokenWorkflowsView_group">
          {{ group.label }}
          <span :class="css.brokenWorkflowsView_count">{{ group.rows.length }}</span>
          <span
            v-if="group.note"
            :class="css.brokenWorkflowsView_note"
            >{{ group.note }}</span
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
          :name-with-owner="row.nameWithOwner"
          :repository="row.nameWithOwner"
          :selected="row.key === selection.selectedKey"
          @open="openRow(row)"
        />
      </section>

      <section
        v-if="broken.unread.length > 0"
        :aria-label="t(l.notKnownYet)"
      >
        <h2 :class="css.brokenWorkflowsView_group">{{ t(l.notKnownYet) }}</h2>
        <div
          v-for="repository in broken.unread"
          :key="repository"
          :class="css.brokenWorkflowsView_row"
        >
          <CircleDashed
            :class="css.brokenWorkflowsView_rowIcon"
            aria-hidden="true"
          />
          <span :class="[css.brokenWorkflowsView_rowName, css.brokenWorkflowsView_rowName_muted]">{{
            t(l.readingRow)
          }}</span>
          <span :class="css.brokenWorkflowsView_rowRepository">{{ repository }}</span>
          <span :class="css.brokenWorkflowsView_rowRef" />
          <RunStrip
            :name-with-owner="repository"
            :runs="[]"
            :new-since="null"
          />
          <span :class="css.brokenWorkflowsView_rowStatus">{{ t(l.notReadYet) }}</span>
        </div>
      </section>

      <section
        v-if="broken.unavailable.length > 0"
        :aria-label="t(l.cantTell)"
      >
        <h2 :class="css.brokenWorkflowsView_group">
          {{ t(l.cantTell) }}
          <span :class="css.brokenWorkflowsView_count">{{ broken.unavailable.length }}</span>
          <span :class="css.brokenWorkflowsView_note">{{ t(l.cantTellNote) }}</span>
        </h2>
        <div
          v-for="entry in broken.unavailable"
          :key="entry.nameWithOwner"
          :class="css.brokenWorkflowsView_row"
        >
          <Ban
            :class="css.brokenWorkflowsView_rowIcon"
            aria-hidden="true"
          />
          <span :class="css.brokenWorkflowsView_rowName">{{ describeUnavailable(entry).name }}</span>
          <span :class="css.brokenWorkflowsView_rowRepository">{{ entry.nameWithOwner }}</span>
          <span :class="css.brokenWorkflowsView_rowRef" />
          <RunStrip
            :name-with-owner="entry.nameWithOwner"
            :runs="[]"
            :new-since="null"
          />
          <span :class="css.brokenWorkflowsView_rowStatus">{{ describeUnavailable(entry).status }}</span>
          <span
            v-if="checkedAt !== null"
            :class="css.brokenWorkflowsView_rowResult"
            >{{ t(l.checkedAgo, { age: formatCheckedAge(checkedAt, now) }) }}</span
          >
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.brokenWorkflowsView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;

  // Focused only to take the keys from where the user came from; it is not a control.
  &:focus {
    outline: none;
  }
}

.brokenWorkflowsView_header {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: 48px;
  padding: 0 20px;
  border-bottom: 1px solid $color-border;
}

.brokenWorkflowsView_headerIcon {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-fg-2;
}

.brokenWorkflowsView_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.brokenWorkflowsView_meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brokenWorkflowsView_hint {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.brokenWorkflowsView_body {
  flex: 1;
  min-height: 0;
  padding-bottom: $spacing-16;
  overflow-y: auto;
}

.brokenWorkflowsView_message {
  display: flex;
  justify-content: center;
  padding: $spacing-96 $spacing-16 $spacing-48;
}

.brokenWorkflowsView_group {
  display: flex;
  gap: $spacing-7;
  align-items: center;
  padding: $spacing-10 $spacing-16 $spacing-6;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

.brokenWorkflowsView_count {
  font-family: $font-family-mono;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.brokenWorkflowsView_note {
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.brokenWorkflowsView_row {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  height: $workflow-row-height;
  padding: 0 $spacing-16;
}

.brokenWorkflowsView_rowIcon {
  flex: none;
  width: 15px;
  height: 15px;
  color: $color-fg-3;
}

.brokenWorkflowsView_rowName {
  flex: none;
  width: $workflow-name-width;
  overflow: hidden;
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brokenWorkflowsView_rowName_muted {
  color: $color-fg-dim;
}

.brokenWorkflowsView_rowRepository {
  flex: none;
  width: $workflow-repository-width;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brokenWorkflowsView_rowRef {
  flex: none;
  width: $workflow-ref-width;
}

.brokenWorkflowsView_rowStatus {
  flex: 1;
  min-width: 0;
  padding-left: $spacing-10;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brokenWorkflowsView_rowResult {
  flex: none;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}
</style>
