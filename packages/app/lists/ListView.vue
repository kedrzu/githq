<!-- The body of every list (D9) — my work, a repository, a project — as List or Board, over groups its owner built. List: each group a section with its header (collapsible) and rows; a group still on its way says so (G7). Board: each group a column with its head and count, cards top to bottom. Rows and cards are the owner's (`row`, `card` slots), and so is what follows a group (`groupFooter`); the list draws them, their selection and the keys. The selected entry is kept by key: when the list changes under it (a sync, an edit) it stays on its entry, follows its item into another group, or moves to the neighbour when its item leaves. `j`/`k` or ↓/↑ move it — on the board within the column, ←/→ to the next column — Enter or a click opens it (an opened item follows the selection), `o` opens it on GitHub. `x` adds it to the items edited together (or takes it out), `⇧↓`/`⇧↑` (`⇧J`/`⇧K`) move on adding, Escape empties them. Right-clicking an entry opens its owner's context menu (`contextMenu`, L1–L4) for the items edited together when it is one of them, else for it alone, which it selects; elsewhere the browser's own menu shows. On the board an entry its owner lets move is dragged to another column or moved with `⇧←`/`⇧→`: `move` asks the owner to set the column's value. -->
<script lang="ts" setup generic="T">
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { ChevronDown, ChevronRight, Loader } from 'lucide-vue-next';
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue';

import type { Command } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import { Browser } from '@/services/Browser.js';
import { followSelection } from '@/utils/followSelection.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenKey } from '@/utils/isScreenKey.js';

import ListGroupMarker from './ListGroupMarker.vue';
import type { ListContextMenuProps, ListEntry, ListGroup, ListLayout, ListMove } from './ListTypes.js';
import * as l from './ListView.loc.js';

const props = withDefaults(
  defineProps<{
    groups: readonly ListGroup<T>[];
    layout: ListLayout;
    /** The item opened over the list (panel or modal): moving the selection opens the next one in its place. */
    openedId?: string | null;
    /** The entry's page on GitHub, for `o`; `null` when it has none (a draft issue). */
    getUrl?: (value: T) => string | null;
    /** Whether the entry may be moved from one group into another (the user may set that value of it). */
    canMove?: (entry: ListEntry<T>, from: string, to: string) => boolean;
  }>(),
  { openedId: null, getUrl: () => null, canMove: () => false },
);

const emit = defineEmits<{
  /** Enter or a click on an entry, or the selection moved while an item is open. */
  open: [id: string];
  /** The items the list shows, top to bottom (column by column on the board), each once. */
  listed: [ids: readonly string[]];
  /** An entry was dropped into another group, or moved there with `⇧←`/`⇧→`. */
  move: [move: ListMove];
}>();

/** The selected item's id. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`), in the list's order. */
const checkedIds = defineModel<readonly string[]>('checkedIds', { default: () => [] });

defineSlots<{
  /** A row of the list: an entry, or one nested under `parent`. */
  row(props: ListSlotProps<T>): unknown;
  /** A card of the board. */
  card(props: ListSlotProps<T>): unknown;
  /** No groups at all. */
  empty?(): unknown;
  /** After a group's rows, or at the bottom of its column: a project's "New draft" there. */
  groupFooter?(props: { group: ListGroup<T> }): unknown;
  /** The entries of the menu a right-click on an entry opens; without it the browser's own menu shows. */
  contextMenu?(props: ListContextMenuProps): unknown;
}>();

/** What a row or a card is drawn from. */
interface ListSlotProps<TValue> {
  entry: ListEntry<TValue>;
  /** The entry it is nested under. */
  parent: ListEntry<TValue> | null;
  group: ListGroup<TValue>;
  /** Among the items edited together. */
  checked: boolean;
}

/** An entry where the list shows it. */
interface Placed {
  readonly entry: ListEntry<T>;
  readonly group: ListGroup<T>;
  /** On the board, the column's index. */
  readonly column: number;
  /** Nested under another entry: never moved on its own. */
  readonly nested: boolean;
}

/** An entry being dragged. */
interface Dragged {
  readonly entry: ListEntry<T>;
  readonly from: string;
}

const t = useTranslate();
const browser = useService(Browser);
const bodyRef = useTemplateRef<HTMLElement>('body');
const collapsed = ref<ReadonlySet<string>>(new Set());
const selectedKey = ref<string | null>(null);
const dragged = shallowRef<Dragged | null>(null);
const dropTarget = ref<string | null>(null);
const menuIds = shallowRef<readonly string[]>([]);

/** Every entry the list shows, in its order: the board's column by column, a collapsed group's left out. */
const placed = computed(() => {
  const entries = new Map<string, Placed>();
  for (const [column, group] of props.groups.entries()) {
    if (props.layout === 'list' && collapsed.value.has(group.key)) {
      continue;
    }

    for (const row of group.rows) {
      entries.set(row.key, { entry: row, group, column, nested: false });
      for (const nested of row.nested) {
        entries.set(nested.key, { entry: nested, group, column, nested: true });
      }
    }
  }

  return entries;
});
const order = computed(() => [...placed.value.keys()]);
/** On the board, the keys of each column top to bottom. */
const columns = computed(() => {
  const keys: string[][] = props.groups.map(() => []);
  for (const [key, { column }] of placed.value) {
    keys[column]?.push(key);
  }

  return keys;
});
const listedIds = computed(() => [...new Set([...placed.value.values()].map(({ entry }) => entry.id))]);

// The selection given from outside (an item opened by its address, a toast's request) lands on the item's first
// entry; one already on that item stays where it is.
watch(
  selectedId,
  id => {
    const current = selectedKey.value === null ? undefined : placed.value.get(selectedKey.value);
    if (current?.entry.id !== id) {
      selectedKey.value = id === null ? null : findKey(order.value, id);
    }
  },
  { immediate: true },
);

watch(order, (next, previous) => {
  const key = selectedKey.value;
  if (key === null && selectedId.value !== null) {
    // Selected before its item was listed (the copy still loading): it is selected once it is.
    selectedKey.value = findKey(next, selectedId.value);
  } else if (key !== null && !next.includes(key)) {
    // Its item moved into another group (an edit, a sync): the selection goes with it.
    const id = selectedId.value;
    const moved = id === null ? null : findKey(next, id);
    select(moved ?? followSelection(previous, next, key));
  }

  // An item that left the list (closed) leaves the items edited together.
  const ids = listedIds.value;
  if (checkedIds.value.some(id => !ids.includes(id))) {
    checkedIds.value = checkedIds.value.filter(id => ids.includes(id));
  }
});
watch(listedIds, ids => emit('listed', ids), { immediate: true });

// The list's keys are its own — handled below, before an opened item's — and listed in the help sheet.
useCommands(() => getKeyCommands());

onWindowEvent('keydown', event => {
  if (!isScreenKey(event)) {
    return;
  }

  const board = props.layout === 'board';
  if (event.shiftKey) {
    switch (event.key) {
      case 'ArrowDown':
      case 'J':
        event.preventDefault();
        extend(1);
        return;
      case 'ArrowUp':
      case 'K':
        event.preventDefault();
        extend(-1);
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (board) {
          event.preventDefault();
          moveSelected(event.key === 'ArrowLeft' ? -1 : 1);
        }

        return;
    }
  }

  switch (event.key) {
    case 'x':
      event.preventDefault();
      toggleChecked();
      return;
    case 'Escape':
      // Before anything else Escape does: an opened item stays open. An open picker or menu takes it first.
      if (checkedIds.value.length > 0 && !isLayerOpen()) {
        event.preventDefault();
        checkedIds.value = [];
      }

      return;
    case 'j':
    case 'ArrowDown':
      event.preventDefault();
      step(1);
      return;
    case 'k':
    case 'ArrowUp':
      event.preventDefault();
      step(-1);
      return;
    case 'ArrowLeft':
    case 'ArrowRight':
      if (board) {
        event.preventDefault();
        stepColumn(event.key === 'ArrowLeft' ? -1 : 1);
      }

      return;
    case 'o':
      event.preventDefault();
      openSelectedOnGitHub();
      return;
    case 'Enter':
      if (!(event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement)) {
        const id = currentId();
        if (id !== null) {
          event.preventDefault();
          emit('open', id);
        }
      }
  }
});

/** The list's keys as the help sheet lists them. */
function getKeyCommands(): Command[] {
  const commands: Command[] = [
    { id: 'list.next', title: t(l.next), section: 'view', key: 'J', otherKeys: ['ArrowDown'], menu: false },
    { id: 'list.previous', title: t(l.previous), section: 'view', key: 'K', otherKeys: ['ArrowUp'], menu: false },
    { id: 'list.open', title: t(l.open), section: 'view', key: 'Enter', menu: false },
    { id: 'list.openOnGitHub', title: t(l.openOnGitHub), section: 'view', key: 'O', menu: false },
    { id: 'list.check', title: t(l.check), section: 'view', key: 'X', menu: false },
    {
      id: 'list.checkNext',
      title: t(l.checkNext),
      section: 'view',
      key: 'Shift+J',
      otherKeys: ['Shift+ArrowDown'],
      menu: false,
    },
    {
      id: 'list.checkPrevious',
      title: t(l.checkPrevious),
      section: 'view',
      key: 'Shift+K',
      otherKeys: ['Shift+ArrowUp'],
      menu: false,
    },
    { id: 'list.uncheck', title: t(l.uncheck), section: 'view', key: 'Escape', menu: false },
  ];
  if (props.layout === 'board') {
    commands.push(
      {
        id: 'list.nextColumn',
        title: t(l.nextColumn),
        section: 'view',
        key: 'ArrowRight',
        otherKeys: ['ArrowLeft'],
        menu: false,
      },
      {
        id: 'list.moveToColumn',
        title: t(l.moveToColumn),
        section: 'view',
        key: 'Shift+ArrowRight',
        otherKeys: ['Shift+ArrowLeft'],
        menu: false,
      },
    );
  }

  return commands;
}

/** Moves the selection `by` entries — on the board within its column; returns the entry it is on now. */
function step(by: 1 | -1) {
  const keys = selectedColumnKeys() ?? order.value;
  if (keys.length === 0) {
    return null;
  }

  const index = selectedKey.value === null ? -1 : keys.indexOf(selectedKey.value);
  const next = index === -1 ? 0 : Math.min(Math.max(index + by, 0), keys.length - 1);
  return go(keys[next] ?? null);
}

/** On the board: to the entry at the same height in the next column that has any. */
function stepColumn(by: 1 | -1) {
  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  if (!key || !current) {
    step(1);
    return;
  }

  const index = columns.value[current.column]?.indexOf(key) ?? 0;
  for (let column = current.column + by; column >= 0 && column < columns.value.length; column += by) {
    const keys = columns.value[column] ?? [];
    if (keys.length > 0) {
      go(keys[Math.min(index, keys.length - 1)] ?? null);
      return;
    }
  }
}

/** On the board, the keys of the selected entry's column; `null` in the list or with nothing selected. */
function selectedColumnKeys() {
  const key = selectedKey.value;
  const current = props.layout === 'board' && key !== null ? placed.value.get(key) : undefined;
  return current ? (columns.value[current.column] ?? null) : null;
}

function go(key: string | null) {
  const id = select(key);
  if (id !== null && props.openedId != null && id !== props.openedId) {
    emit('open', id);
  }

  void nextTick(scrollToSelected);
  return id;
}

/** `⇧←`/`⇧→` on the board: the selected entry into the next column that takes it. */
function moveSelected(by: 1 | -1) {
  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  if (!current || current.nested) {
    return;
  }

  for (let column = current.column + by; column >= 0 && column < props.groups.length; column += by) {
    const group = props.groups[column];
    if (group && canDrop(current.entry, current.group.key, group)) {
      emit('move', { id: current.entry.id, from: current.group.key, to: group.key });
      return;
    }
  }
}

function toggleChecked() {
  const id = currentId();
  if (id === null) {
    return;
  }

  setChecked(
    checkedIds.value.includes(id) ? checkedIds.value.filter(other => other !== id) : [...checkedIds.value, id],
  );
}

/** Adds the selected entry and the one `by` away, and moves there. */
function extend(by: 1 | -1) {
  const before = currentId();
  const after = step(by);
  setChecked([...checkedIds.value, ...[before, after].filter(id => id !== null)]);
}

/** In the list's order, each once. */
function setChecked(ids: readonly string[]) {
  const wanted = new Set(ids);
  checkedIds.value = listedIds.value.filter(id => wanted.has(id));
}

function openEntry(key: string) {
  const id = select(key);
  if (id !== null) {
    emit('open', id);
  }
}

/** Selects the entry; returns its item's id. */
function select(key: string | null) {
  const id = key === null ? null : (placed.value.get(key)?.entry.id ?? null);
  selectedKey.value = key;
  selectedId.value = id;
  return id;
}

/**
 * The selected item's id — read from the entry, as the model given by the owner changes only once it re-renders.
 */
function currentId() {
  const key = selectedKey.value;
  return key === null ? selectedId.value : (placed.value.get(key)?.entry.id ?? null);
}

function openSelectedOnGitHub() {
  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  const url = current ? props.getUrl(current.entry.value) : null;
  if (url) {
    browser.openInNewTab(url);
  }
}

function scrollToSelected() {
  const key = selectedKey.value;
  const element = key === null ? null : bodyRef.value?.querySelector(`[data-entry-key="${CSS.escape(key)}"]`);
  element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function toggleGroup(key: string) {
  const next = new Set(collapsed.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }

  collapsed.value = next;
}

function isDraggable(entry: ListEntry<T>, group: ListGroup<T>) {
  return props.layout === 'board' && props.groups.some(other => canDrop(entry, group.key, other));
}

function canDrop(entry: ListEntry<T>, from: string, group: ListGroup<T>) {
  return group.droppable && group.key !== from && props.canMove(entry, from, group.key);
}

function startDrag(event: DragEvent, entry: ListEntry<T>, group: ListGroup<T>) {
  dragged.value = { entry, from: group.key };
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.id);
  }
}

function dragOver(event: DragEvent, group: ListGroup<T>) {
  const drag = dragged.value;
  if (drag && canDrop(drag.entry, drag.from, group)) {
    event.preventDefault();
    dropTarget.value = group.key;
  }
}

function drop(event: DragEvent, group: ListGroup<T>) {
  const drag = dragged.value;
  endDrag();
  if (drag && canDrop(drag.entry, drag.from, group)) {
    event.preventDefault();
    select(drag.entry.key);
    emit('move', { id: drag.entry.id, from: drag.from, to: group.key });
  }
}

function endDrag() {
  dragged.value = null;
  dropTarget.value = null;
}

/**
 * A right-click: on an entry, the menu is for the items edited together when it is one of them, else for it alone,
 * which is selected. Anywhere else the menu does not open (it never sees the event) and the browser's shows.
 */
function prepareContextMenu(event: MouseEvent) {
  const row = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-entry-key]') : null;
  const key = row?.dataset.entryKey;
  const entry = key === undefined ? undefined : placed.value.get(key)?.entry;
  if (key === undefined || !entry) {
    event.stopImmediatePropagation();
    return;
  }

  if (checkedIds.value.length > 1 && checkedIds.value.includes(entry.id)) {
    menuIds.value = checkedIds.value;
    return;
  }

  menuIds.value = [entry.id];
  select(key);
}

function openFromMenu() {
  const [id] = menuIds.value;
  if (menuIds.value.length === 1 && id !== undefined) {
    emit('open', id);
  }
}

function findKey(keys: readonly string[], id: string) {
  return keys.find(key => placed.value.get(key)?.entry.id === id) ?? null;
}
</script>

<template>
  <ContextMenu :disabled="!$slots.contextMenu">
    <div
      ref="body"
      :class="[css.listView, layout === 'board' && css.listView_board]"
      :tabindex="layout === 'board' ? 0 : undefined"
      @contextmenu.capture="prepareContextMenu"
    >
      <slot
        v-if="groups.length === 0"
        name="empty"
      />

      <template v-else-if="layout === 'list'">
        <section
          v-for="group in groups"
          :key="group.key"
          :aria-label="group.label"
        >
          <!-- A group on its way (G7) has no rows yet. -->
          <template v-if="!group.arrived">
            <h2 :class="css.listView_groupHeader">
              <span :class="css.listView_groupLabel">
                <ChevronDown
                  :class="css.listView_chevron"
                  aria-hidden="true"
                />
                {{ group.label }}
                <span :class="css.listView_count">{{ t(l.countArriving) }}</span>
              </span>
            </h2>
            <p :class="css.listView_note">
              <Loader
                :class="css.listView_noteIcon"
                aria-hidden="true"
              />
              {{ t(l.arriving) }}
            </p>
          </template>
          <template v-else>
            <h2 :class="css.listView_groupHeader">
              <Button
                variant="link"
                :icon="collapsed.has(group.key) ? ChevronRight : ChevronDown"
                :aria-expanded="!collapsed.has(group.key)"
                @click="toggleGroup(group.key)"
              >
                <ListGroupMarker
                  v-if="group.marker"
                  :marker="group.marker"
                />
                <span :class="group.monospace && css.listView_mono">{{ group.label }}</span>
                <span :class="css.listView_count">{{ group.rows.length }}</span>
              </Button>
              <span
                v-if="group.detail"
                :class="css.listView_detail"
              >
                <component
                  :is="group.detailIcon"
                  v-if="group.detailIcon"
                  :class="css.listView_detailIcon"
                  aria-hidden="true"
                />
                {{ group.detail }}
              </span>
            </h2>
            <p
              v-if="group.rows.length === 0"
              :class="css.listView_note"
            >
              {{ t(l.groupEmpty) }}
            </p>
            <ul
              v-else-if="!collapsed.has(group.key)"
              :class="css.listView_rows"
            >
              <template
                v-for="row in group.rows"
                :key="row.key"
              >
                <li
                  v-for="{ entry, parent } in [
                    { entry: row, parent: null },
                    ...row.nested.map(nested => ({ entry: nested, parent: row })),
                  ]"
                  :key="entry.key"
                  :class="[
                    css.listView_row,
                    selectedKey === entry.key && css.listView_row_selected,
                    checkedIds.includes(entry.id) && css.listView_row_checked,
                  ]"
                  :aria-current="selectedKey === entry.key ? 'true' : undefined"
                  :data-entry-key="entry.key"
                  @click="openEntry(entry.key)"
                >
                  <slot
                    name="row"
                    :entry="entry"
                    :parent="parent"
                    :group="group"
                    :checked="checkedIds.includes(entry.id)"
                  />
                </li>
              </template>
            </ul>
            <slot
              v-if="!collapsed.has(group.key)"
              name="groupFooter"
              :group="group"
            />
          </template>
        </section>
      </template>

      <template v-else>
        <section
          v-for="group in groups"
          :key="group.key"
          :aria-label="group.label"
          :class="[css.listView_column, dropTarget === group.key && css.listView_column_target]"
          @dragover="dragOver($event, group)"
          @dragleave="dropTarget = dropTarget === group.key ? null : dropTarget"
          @drop="drop($event, group)"
        >
          <h2 :class="css.listView_columnHead">
            <ListGroupMarker
              v-if="group.marker"
              :marker="group.marker"
            />
            <span :class="[css.listView_columnLabel, group.monospace && css.listView_mono]">{{ group.label }}</span>
            <span :class="css.listView_count">{{ group.arrived ? group.rows.length : t(l.countArriving) }}</span>
          </h2>
          <p
            v-if="!group.arrived"
            :class="css.listView_cardNote"
          >
            <Loader
              :class="css.listView_noteIcon"
              aria-hidden="true"
            />
            {{ t(l.arriving) }}
          </p>
          <p
            v-else-if="group.rows.length === 0"
            :class="css.listView_cardNote"
          >
            {{ t(l.groupEmpty) }}
          </p>
          <ul
            v-else
            :class="css.listView_cards"
          >
            <template
              v-for="row in group.rows"
              :key="row.key"
            >
              <li
                v-for="{ entry, parent } in [
                  { entry: row, parent: null },
                  ...row.nested.map(nested => ({ entry: nested, parent: row })),
                ]"
                :key="entry.key"
                :class="[
                  css.listView_card,
                  parent && css.listView_card_nested,
                  selectedKey === entry.key && css.listView_card_selected,
                  checkedIds.includes(entry.id) && css.listView_card_checked,
                  dragged?.entry.key === entry.key && css.listView_card_dragged,
                ]"
                :aria-current="selectedKey === entry.key ? 'true' : undefined"
                :data-entry-key="entry.key"
                :draggable="!parent && isDraggable(entry, group) ? 'true' : undefined"
                @click="openEntry(entry.key)"
                @dragstart="startDrag($event, entry, group)"
                @dragend="endDrag"
              >
                <slot
                  name="card"
                  :entry="entry"
                  :parent="parent"
                  :group="group"
                  :checked="checkedIds.includes(entry.id)"
                />
              </li>
            </template>
          </ul>
          <slot
            v-if="group.arrived"
            name="groupFooter"
            :group="group"
          />
        </section>
      </template>
    </div>
    <template #content>
      <slot
        name="contextMenu"
        :ids="menuIds"
        :open="openFromMenu"
      />
    </template>
  </ContextMenu>
</template>

<style lang="scss" module="css">
.listView {
  flex: 1;
  min-height: 0;
  padding: $spacing-4 0;
  overflow-y: auto;
}

.listView_board {
  @include focus-ring;

  display: flex;
  gap: $spacing-12;
  align-items: flex-start;
  padding: $spacing-12 $spacing-16 $spacing-16;
  overflow-x: auto;
}

.listView_groupHeader {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: 10px $spacing-16 6px;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-2;
}

// Laid out as the toggle of a group that has arrived (`Button`, `link`).
.listView_groupLabel {
  display: inline-flex;
  gap: 7px;
  align-items: center;
}

.listView_chevron {
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.listView_count {
  font-family: $font-family-mono;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.listView_detail {
  display: inline-flex;
  gap: $spacing-4;
  align-items: center;
  font-weight: $font-weight-normal;
  color: $color-fg-dim;
}

.listView_detailIcon {
  width: 11px;
  height: 11px;
}

.listView_mono {
  font-family: $font-family-mono;
}

.listView_note {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-16 $spacing-8 40px;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.listView_noteIcon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.listView_rows,
.listView_cards {
  padding: 0;
  margin: 0;
  list-style: none;
}

.listView_row {
  cursor: default;

  &:hover {
    background: $color-bg-2;
  }
}

.listView_row_selected,
.listView_row_selected:hover {
  background: $color-sel;
  box-shadow: inset 2px 0 0 $color-accent;
}

.listView_row_checked,
.listView_row_checked:hover {
  background: rgba($color-accent, 0.1);
}

.listView_column {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: $spacing-8;
  width: 268px;
  max-height: 100%;
  padding: $spacing-8;
  background: $color-bg-2;
  border: 1px solid transparent;
  border-radius: $radius-xl;
}

.listView_column_target {
  border-color: $color-accent;
}

.listView_columnHead {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-4 $spacing-6 $spacing-6;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.listView_columnLabel {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listView_cardNote {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-4 $spacing-6;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.listView_cards {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  min-height: 0;
  overflow-y: auto;
}

.listView_card {
  flex: none;
  cursor: default;
  background: $color-bg-3;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &:hover {
    border-color: $color-border-2;
  }

  &[draggable='true'] {
    cursor: grab;
  }
}

.listView_card_nested {
  margin-top: -$spacing-4;
  margin-left: $spacing-16;
}

.listView_card_selected,
.listView_card_selected:hover {
  background: $color-sel;
  border-color: $color-accent;
}

.listView_card_checked {
  background: rgba($color-accent, 0.1);
}

.listView_card_dragged {
  opacity: 0.5;
}
</style>
