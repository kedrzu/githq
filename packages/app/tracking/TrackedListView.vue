<!-- Settings' Repositories and Projects (G8, T17, D25, D44): the head (`TrackedListHead`, "15 tracked repositories", "⌥↑ ⌥↓ Move" and "Track repositories A"), then only what is tracked, one flat list in the user's order (`rows`, the sidebar's), each row naming its owner in the `row` slot. A row opens its settings on click or Enter, and is dragged into another place (`useSortableRows`, as in the sidebar): the row moves under the pointer, the others make room, sliding while `animate`, and the drop is told as `move` against the rows shown; a click without a drag still opens it. Keys while it is shown and no layer is open, never from a field: J/K and ↑/↓ move the selection, Enter opens the selected row, ⌥↑ / ⌥↓ move it a place up or down (`move`; nothing at the ends, the selection staying on it), ⌫ untracks it — the selection moving to the next row, the previous one after the last — and A adds more (the picker); `1` to `4` stay Settings'. Nothing tracked, the note in its place says what tracking does, its button adding the first (`NothingThere`, first run and loading D6, ES24), once what is tracked is known: nothing says "none" before. On a phone (`phone`, mobile D35, MB151, MB154, MB162) no head — the screen's top bar has the title and "+" — but a line saying what githq does with them, then the same flat list without dragging, each row a button drilling into its settings; nothing tracked, the note's button is the screen's one action, the width of its column. The keys stay, with no hints drawn. -->
<script lang="ts" setup generic="T">
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookMarked, Plus, SquareKanban } from 'lucide-vue-next';
import { computed, useCssModule, useTemplateRef } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';

import { bindCommand } from '@/commands/bindCommand.js';
import * as definitions from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { keyOf } from '@/commands/keyOf.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import NothingThere from '@/components/NothingThere.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import TrackedListHead from './TrackedListHead.vue';
import * as l from './TrackedListView.loc.js';
import { useSortableRows } from './useSortableRows.js';
import type { SortablePlace } from './useSortableRows.js';

const props = defineProps<{
  /** What is listed, and so the words. */
  kind: 'repositories' | 'projects';
  /** What is tracked, in the user's order, less what is being untracked. */
  rows: readonly T[];
  /** What tells the rows apart, kept while the list changes under the selection. */
  getKey: (row: T) => string;
  /** What is tracked is known: until then, no rows says nothing. */
  loaded: boolean;
  /** On a phone: no head, rows a finger's height that drill in, no dragging. */
  phone?: boolean;
  /** The other rows make room for a dragged one by sliding: the app's animations on, and no reduced motion asked for. */
  animate?: boolean;
}>();

const emit = defineEmits<{
  /** Its settings (T16, T17). */
  open: [row: T];
  untrack: [row: T];
  /** The picker. */
  add: [];
  /** A row dragged, or moved with ⌥↑ / ⌥↓, to another place among the rows shown (D44). */
  move: [row: T, place: SortablePlace<T>];
}>();

defineSlots<{
  row(props: { row: T; selected: boolean }): unknown;
}>();

const t = useTranslate();
const css = useCssModule('css');
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const root = useTemplateRef('root');

// A copy: Sortable is given the list, never the caller's array.
const rows = computed(() => [...props.rows]);
// A row gone (untracked here or elsewhere): the selection goes to the next one, the previous one after the last.
const selection = useRowSelection({
  rows,
  getKey: row => props.getKey(row),
  root,
  keyAttribute: 'data-tracked-key',
  open: row => emit('open', row),
  place: 'trackedList',
  openTitle: l.open,
});
const sortable = useSortableRows<T>({
  animate: () => props.animate,
  ghostClass: css.trackedListView_dragged,
  floatingClass: css.trackedListView_floating,
  move: (row, place) => emit('move', row, place),
});
const projects = computed(() => props.kind === 'projects');
const listLabel = computed(() => t(projects.value ? l.projectsList : l.repositoriesList));
const addLabel = computed(() => t(projects.value ? l.addProjects : l.addRepositories));

useCommands(() => [
  bindCommand(
    definitions.add,
    { place: 'trackedList', section: 'view', title: addLabel.value, run: () => emit('add') },
    t,
  ),
  bindCommand(
    definitions.remove,
    {
      place: 'trackedList',
      section: 'view',
      title: t(l.untrack),
      menu: false,
      actsOnRow: true,
      when: () => selection.selectedRow !== null,
      run: () => {
        if (selection.selectedRow !== null) {
          emit('untrack', selection.selectedRow);
        }
      },
    },
    t,
  ),
  bindCommand(definitions.moveUp, { ...moveBinding(), run: () => moveSelected(-1) }, t),
  bindCommand(definitions.moveDown, { ...moveBinding(), run: () => moveSelected(1) }, t),
]);

function moveBinding() {
  return {
    place: 'trackedList',
    section: 'view',
    menu: false,
    actsOnRow: true,
    when: () => selection.selectedRow !== null,
  } as const;
}

/** The selected row a place up (before the row above) or down (after the row below); nothing at the ends. */
function moveSelected(by: 1 | -1) {
  const row = selection.selectedRow;
  if (row === null) {
    return;
  }

  const anchor = rows.value[rows.value.indexOf(row) + by];
  if (anchor !== undefined) {
    emit('move', row, { anchor, side: by > 0 ? 'after' : 'before' });
  }
}

/** The row's own buttons (Untrack) do what they say instead. */
function onRowClick(event: MouseEvent, row: T) {
  if (!isActivatableTarget(event.target)) {
    emit('open', row);
  }
}
</script>

<template>
  <div
    v-if="phone"
    ref="root"
    :class="css.trackedListView_phone"
  >
    <NothingThere
      v-if="loaded && rows.length === 0"
      place="screen"
      :icon="projects ? SquareKanban : BookMarked"
      :title="t(projects ? l.noProjectsTitle : l.noRepositoriesTitle)"
      :detail="t(projects ? l.noProjectsDetailPhone : l.noRepositoriesDetailPhone)"
    >
      <template #action>
        <Button
          variant="primary"
          size="lg"
          :class="css.trackedListView_phoneAdd"
          @click="emit('add')"
        >
          {{ addLabel }}
        </Button>
      </template>
    </NothingThere>
    <template v-else-if="rows.length > 0">
      <p :class="css.trackedListView_phoneDescription">
        {{ t(projects ? l.projectsDescriptionPhone : l.repositoriesDescriptionPhone) }}
      </p>
      <ul
        :class="css.trackedListView_rows"
        :aria-label="listLabel"
      >
        <li
          v-for="row in rows"
          :key="getKey(row)"
          :data-tracked-key="getKey(row)"
        >
          <button
            type="button"
            :class="css.trackedListView_phoneRow"
            @click="emit('open', row)"
          >
            <slot
              name="row"
              :row="row"
              :selected="false"
            />
          </button>
        </li>
      </ul>
    </template>
  </div>
  <div
    v-else
    ref="root"
    :class="css.trackedListView"
    :data-route-scroll="`settings-tracked:${kind}`"
  >
    <NothingThere
      v-if="loaded && rows.length === 0"
      place="screen"
      :icon="projects ? SquareKanban : BookMarked"
      :title="t(projects ? l.noProjectsTitle : l.noRepositoriesTitle)"
      :detail="t(projects ? l.noProjectsDetail : l.noRepositoriesDetail)"
    >
      <template #action>
        <Button
          variant="primary"
          size="lg"
          :icon="Plus"
          :kbd="keyOf(definitions.add)"
          :keyshortcuts="formatAriaKeyShortcuts(keyOf(definitions.add))"
          @click="emit('add')"
        >
          {{ addLabel }}
        </Button>
      </template>
    </NothingThere>
    <div
      v-else-if="rows.length > 0"
      :class="css.trackedListView_content"
    >
      <TrackedListHead
        :title="
          t(projects ? l.projectsTitle : l.repositoriesTitle, {
            count: rows.length,
            formatted: numbers.format(rows.length),
          })
        "
        :description="t(projects ? l.projectsDescription : l.repositoriesDescription)"
        :add-label="addLabel"
        :add-key="keyOf(definitions.add)"
        :move-label="t(l.move)"
        :move-up-key="keyOf(definitions.moveUp)"
        :move-down-key="keyOf(definitions.moveDown)"
        @add="emit('add')"
      />
      <VueDraggable
        :model-value="rows"
        tag="ul"
        :class="css.trackedListView_rows"
        :aria-label="listLabel"
        data-screen-keys
        v-bind="sortable.bind('rows', rows)"
      >
        <li
          v-for="row in rows"
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
      </VueDraggable>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.trackedListView_phone {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.trackedListView_phoneDescription {
  padding: $spacing-12 $spacing-16 $spacing-4;
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.trackedListView_phoneRow {
  display: block;
  width: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: start;
  cursor: pointer;
  background: none;
  border: none;

  &:active {
    background: $color-bg-3;
  }

  @include focus-ring(-2px);
}

.trackedListView_phoneAdd {
  width: 100%;
}

.trackedListView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 20px $spacing-12;
  overflow-y: auto;
}

.trackedListView_content {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  max-width: $settings-column-width;
}

.trackedListView_rows {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
}

// The dragged row's own place in the list while a copy of it moves under the pointer: left empty, for nothing to mark
// where it will land (D44).
.trackedListView_dragged {
  opacity: 0;
}

// The row moving under the pointer: Sortable's copy of it, on `<body>`, out of the list, so it takes its look along.
.trackedListView_floating {
  list-style: none;
  background: $color-bg-2;
  border-radius: $radius-md;
}

.trackedListView_floating,
.trackedListView_floating * {
  pointer-events: none !important;
}
</style>
