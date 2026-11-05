<!-- Settings' Repositories and Projects (G8, T17, D25): the head (`TrackedListHead`, "15 tracked repositories" and "Track repositories A"), then only what is tracked, by owner (`groupTrackedByOwner`), each group under its header (`TrackedOwnerHeader`) with its rows in the `row` slot. A row opens its settings on click or Enter. Keys while it is shown and no layer is open, never from a field: J/K and ↑/↓ move the selection, Enter opens the selected row, ⌫ untracks it — the selection moving to the next row, the previous one after the last — and A adds more (the picker); `1` to `4` stay Settings'. Nothing tracked, it is the head alone. -->
<script lang="ts" setup generic="T">
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { computed, useTemplateRef } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isScreenKey } from '@/utils/isScreenKey.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import TrackedListHead from './TrackedListHead.vue';
import * as l from './TrackedListView.loc.js';
import TrackedOwnerHeader from './TrackedOwnerHeader.vue';
import type { TrackedOwnerGroup } from './utils/groupTrackedByOwner.js';

/** The key adding more. */
const ADD_KEY = 'A';

const props = defineProps<{
  /** What is listed, and so the words. */
  kind: 'repositories' | 'projects';
  groups: readonly TrackedOwnerGroup<T>[];
  /** What tells the rows apart, kept while the list changes under the selection. */
  getKey: (row: T) => string;
}>();

const emit = defineEmits<{
  /** Its settings (T16, T17). */
  open: [row: T];
  untrack: [row: T];
  /** The picker, on an owner for a group's "Track more". */
  add: [owner?: string];
}>();

defineSlots<{
  row(props: { row: T; selected: boolean }): unknown;
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const root = useTemplateRef('root');

const rows = computed(() => props.groups.flatMap(group => group.rows));
// A row gone (untracked here or elsewhere): the selection goes to the next one, the previous one after the last.
const selection = useRowSelection({
  rows,
  getKey: row => props.getKey(row),
  root,
  keyAttribute: 'data-tracked-key',
  open: row => emit('open', row),
});
const projects = computed(() => props.kind === 'projects');
const addLabel = computed(() => t(projects.value ? l.addProjects : l.addRepositories));

useCommands(() => [
  { id: 'tracking.add', title: addLabel.value, section: 'view', key: ADD_KEY, run: () => emit('add') },
  { id: 'tracking.next', title: t(l.next), section: 'view', key: 'J', otherKeys: ['ArrowDown'], menu: false },
  { id: 'tracking.previous', title: t(l.previous), section: 'view', key: 'K', otherKeys: ['ArrowUp'], menu: false },
  { id: 'tracking.open', title: t(l.open), section: 'view', key: 'Enter', menu: false },
  { id: 'tracking.untrack', title: t(l.untrack), section: 'view', key: 'Backspace', menu: false },
]);

onWindowEvent('keydown', event => {
  if (event.key === 'Backspace' && isScreenKey(event) && selection.selectedRow !== null) {
    event.preventDefault();
    emit('untrack', selection.selectedRow);
  }
});

/** The row's own buttons (Untrack) do what they say instead. */
function onRowClick(event: MouseEvent, row: T) {
  if (!isActivatableTarget(event.target)) {
    emit('open', row);
  }
}
</script>

<template>
  <div
    ref="root"
    :class="css.trackedListView"
  >
    <div :class="css.trackedListView_content">
      <TrackedListHead
        :title="
          t(projects ? l.projectsTitle : l.repositoriesTitle, {
            count: rows.length,
            formatted: numbers.format(rows.length),
          })
        "
        :description="t(projects ? l.projectsDescription : l.repositoriesDescription)"
        :add-label="addLabel"
        :add-key="ADD_KEY"
        @add="emit('add')"
      />
      <section
        v-for="group in groups"
        :key="group.login"
        :class="css.trackedListView_group"
      >
        <TrackedOwnerHeader
          :group="group"
          :kind="kind"
          @track-more="emit('add', group.login)"
        />
        <ul
          :class="css.trackedListView_rows"
          :aria-label="group.login"
          data-screen-keys
        >
          <li
            v-for="row in group.rows"
            :key="getKey(row)"
            :data-tracked-key="getKey(row)"
            :aria-current="getKey(row) === selection.selectedKey ? 'true' : undefined"
            @click="onRowClick($event, row)"
          >
            <slot
              name="row"
              :row="row"
              :selected="getKey(row) === selection.selectedKey"
            />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.trackedListView {
  flex: 1;
  min-height: 0;
  padding: 20px $spacing-12;
  overflow-y: auto;
}

.trackedListView_content {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.trackedListView_group {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.trackedListView_rows {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>
