<!-- The body of every list (D9) — my work, a repository, a project — as List or Board, over groups its owner built. List: each group a section with its header (collapsible) and rows; a group still on its way says so (G7). Board: each group a column with its head and count, cards top to bottom. Rows and cards are the owner's (`row`, `card` slots), and so is what follows a group (`groupFooter`); the list draws them, their selection and the keys. The selected entry is kept by key: when the list changes under it (a sync, an edit) it stays on its entry, follows its item into another group, or moves to the neighbour when its item leaves. `j`/`k` or ↓/↑ move it — on the board within the column, ←/→ to the next column — Enter or a click opens it (an opened item follows the selection), `o` opens it on GitHub. `x` adds it to the items edited together (or takes it out), `⇧↓`/`⇧↑` (`⇧J`/`⇧K`) move on adding, Escape empties them. Right-clicking an entry opens its owner's context menu (`contextMenu`, L1–L4) for the items edited together when it is one of them, else for it alone, which it selects; elsewhere the browser's own menu shows. On the board an entry its owner lets move is dragged to another column or moved with `⇧←`/`⇧→`: `move` asks the owner to set the column's value of each item it moves — a stack's card all its pull requests, and only when each may move (D3). A stack's entry (a row with `stack`, D2, D3) stands for its pull requests in its group — a share of the stack's open ones when they are spread over groups (D16), never the others: collapsed until expanded — a chevron in its gutter, `→`/`←`, `←` on one of its rows selecting it — for the session and in every list (`ExpandedStacks`, D10); Enter opens the pull request it names (D9), and while an item is open over the list `j`/`k` walk the pull requests one by one, collapsed or not: a collapsed entry's member by member, entering it at its first from above and at its last from below, and an expanded one's rows, passing over the entry itself; `x` and the context menu take all its pull requests (D20), and `⇧J`/`⇧K` cross it in one step adding them all — an expanded one row by row — the entry half marked while only some of them are taken (`halfChecked`). Under a filter its rows not matching are de-emphasised (`ListStack.unmatched`, SP25). Stacks' entries may be nested under a row (`ListRow.stacks`, my work's stacks closing an assigned issue: D12, D23): in the list a lone one makes the row its header — the row takes the stack's chevron, `→`/`←` and expanded state, its pull requests are the row's rows, on a rail; Enter and `x` are the row's own item's, and with an item open `j`/`k` walk a collapsed header's own item and then its pull requests, as a collapsed entry's — while two or more are entries one step in, each with its pull requests on a rail below it; on the board each is a nested card. On the board it is one card (SP26, SP27), `j`/`k` stepping over it as over any: expanded — its chevron, or Space, as ←/→ step between columns there — it lists its pull requests inside it (the owner's card draws them, from `expanded`, `selectedMember`, `toggleStack` and `openMember`), and with an item open `j`/`k` walk them member by member, expanded or not. The list hands over the items it shows as `listed` — a stack's pull requests one by one, collapsed or not, never the entry's own id — and an item opened inside a collapsed entry keeps the entry selected. -->
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
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { followSelection } from '@/utils/followSelection.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenKey } from '@/utils/isScreenKey.js';

import { ExpandedStacks } from './ExpandedStacks.js';
import ListGroupMarker from './ListGroupMarker.vue';
import type {
  ListContextMenuProps,
  ListEntry,
  ListGroup,
  ListLayout,
  ListMove,
  ListRow,
  ListStack,
} from './ListTypes.js';
import * as l from './ListView.loc.js';

const props = withDefaults(
  defineProps<{
    groups: readonly ListGroup<T>[];
    layout: ListLayout;
    /** The item opened over the list (panel or modal): moving the selection opens the next one in its place. */
    openedId?: string | null;
    /** The entry's page on GitHub, for `o`; `null` when it has none (a draft issue). */
    getUrl?: (value: T) => string | null;
    /**
     * Whether the entry may be moved from one group into another (the user may set that value of it); a stack's entry
     * may when each of its pull requests may.
     */
    canMove?: (entry: ListEntry<T>, from: string, to: string) => boolean;
  }>(),
  { openedId: null, getUrl: () => null, canMove: () => false },
);

const emit = defineEmits<{
  /** Enter or a click on an entry, or the selection moved while an item is open. */
  open: [id: string];
  /**
   * The items the list shows, top to bottom (column by column on the board), each once: a stack's entry gives its pull
   * requests, collapsed or not.
   */
  listed: [ids: readonly string[]];
  /** An entry was dropped into another group, or moved there with `⇧←`/`⇧→`. */
  move: [move: ListMove];
}>();

/** The selected item's id; on a stack's entry, the pull request Enter opens or the one opened inside it. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`), in the list's order — never a stack entry's own id. */
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
  /** Among the items edited together; a stack's entry when all its pull requests are. */
  checked: boolean;
  /** A stack's entry some of whose pull requests are among the items edited together, not all (D20, SP28): a half mark. */
  halfChecked: boolean;
  /** Set on a stack's entry: draw it as one. */
  stack: ListStack | null;
  /** Set on an entry serving as a stack's header (`ListRow.stacks`, D12): draw the stack's pips and state on it. */
  header: ListStack | null;
  /** How deep it is nested: 0 a top-level entry, 2 a pull request of a stack with a header of its own under an issue (D23). */
  depth: number;
  /** Set on a pull request listed alone out of its stack (`ListRow.stackMarker`): draw its marker (D16). */
  stackMarker: StackDescription | null;
  /** The entries nested under it, shown or not: a stack entry's pull requests. */
  nested: readonly ListEntry<TValue>[];
  /** A stack's entry, or a stack's header, is expanded: on the board, a stack's card lists its pull requests inside it. */
  expanded: boolean;
  /** On the selected stack's entry, the pull request selected in it; else `null`. */
  selectedMember: string | null;
  /** Expands or collapses a stack's entry (its card's chevron). */
  toggleStack: () => void;
  /** Selects one of a stack card's pull requests and opens it (a click on it inside the expanded card). */
  openMember: (id: string) => void;
}

/** An entry where the list shows it. */
interface Placed {
  readonly entry: ListEntry<T>;
  readonly group: ListGroup<T>;
  /** On the board, the column's index. */
  readonly column: number;
  /** The entry it is nested under — it is never moved on its own; on a stack's pull request, what expands it. */
  readonly parent: ListRow<T> | null;
  /** 0 for a top-level entry, 1 nested under one, 2 a pull request of a stack's entry nested under one (D23). */
  readonly depth: number;
  /** Set on a stack's entry. */
  readonly stack: ListStack | null;
  /** Set on an entry serving as its one nested stack's header (`ListRow.stacks`, D12): it takes the stack's chevron. */
  readonly header: ListStack | null;
  /** Set on the row of a stack's pull request: its stack. */
  readonly memberOf: ListStack | null;
  /** A stack's pull request under an issue (D12, D23): on a rail below what expands it. */
  readonly rail: boolean;
  /** The entries nested under it, shown or not: a stack entry's pull requests, a row's own. */
  readonly nested: readonly ListEntry<T>[];
  /** The items it stands for: its own, or a stack entry's pull requests. */
  readonly ids: readonly string[];
  /**
   * The items it stands for as the list lists and walks them: a stack's header its own and then its stack's pull requests
   * (D23), else as `ids`.
   */
  readonly walked: readonly string[];
  /** The item Enter opens. */
  readonly openId: string;
  /** What moving it into another group moves: itself, a stack entry's pull requests, none for a nested entry. */
  readonly moved: readonly ListEntry<T>[];
}

/** An entry being dragged. */
interface Dragged {
  readonly key: string;
  readonly moved: readonly ListEntry<T>[];
  readonly from: string;
}

const t = useTranslate();
const browser = useService(Browser);
const expandedStacks = useService(ExpandedStacks);
const bodyRef = useTemplateRef<HTMLElement>('body');
const collapsed = ref<ReadonlySet<string>>(new Set());
const selectedKey = ref<string | null>(null);
const dragged = shallowRef<Dragged | null>(null);
const dropTarget = ref<string | null>(null);
const menuIds = shallowRef<readonly string[]>([]);
/** The item the context menu's "Open" opens; `null` when it is for several. */
const menuOpenId = ref<string | null>(null);

/** Each top-level entry and those shown nested under it, in order, by the entry's key. */
const shownByRow = computed(() => {
  const shown = new Map<string, Placed[]>();
  for (const [column, group] of props.groups.entries()) {
    for (const row of group.rows) {
      shown.set(row.key, placeRow(row, group, column));
    }
  }

  return shown;
});
/**
 * Every entry the list shows, in its order: the board's column by column, a collapsed group's left out, and so are
 * the rows of a collapsed stack's entry or header.
 */
const placed = computed(() => {
  const entries = new Map<string, Placed>();
  for (const group of props.groups) {
    if (props.layout === 'list' && collapsed.value.has(group.key)) {
      continue;
    }

    for (const row of group.rows) {
      for (const current of shownByRow.value.get(row.key) ?? []) {
        entries.set(current.entry.key, current);
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
const listedIds = computed(() => [...new Set([...placed.value.values()].flatMap(({ walked }) => walked))]);

// The selection given from outside (an item opened by its address, a toast's request, `J` in an opened item) lands on
// the item's first entry — a collapsed stack's entry or header for one of its pull requests; one already on that item
// stays where it is. On an expanded stack's entry or header, another of its pull requests moves it onto that one's row.
watch(
  selectedId,
  id => {
    const key = selectedKey.value;
    const current = key === null ? undefined : placed.value.get(key);
    const toggled = current && getToggled(current);
    if (key === null || id === null || !current?.walked.includes(id)) {
      selectedKey.value = id === null ? null : findKey(order.value, id);
    } else if (toggled && id !== current.openId && expandedStacks.has(toggled.id)) {
      selectedKey.value = order.value.find(other => isNestedRowOf(other, key, id)) ?? key;
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
      } else if (expandSelected(event.key === 'ArrowRight')) {
        event.preventDefault();
      }

      return;
    case ' ':
      // On the board ←/→ step between columns: Space expands or collapses the selected stack's card.
      if (board && !isActivatableTarget(event.target) && toggleSelectedStack()) {
        event.preventDefault();
      }

      return;
    case 'o':
      event.preventDefault();
      openSelectedOnGitHub();
      return;
    case 'Enter':
      if (!isActivatableTarget(event.target)) {
        const id = currentOpenId();
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

  if ([...placed.value.values()].some(current => getToggled(current) !== null)) {
    commands.push({
      id: 'list.toggleStack',
      title: t(l.toggleStack),
      section: 'view',
      ...(props.layout === 'list' ? { key: 'ArrowRight', otherKeys: ['ArrowLeft'] } : { key: 'Space' }),
      menu: false,
    });
  }

  return commands;
}

/**
 * Moves the selection `by` entries — on the board within its column; returns the entry it is on now. With an item open
 * it walks a stack's pull requests one by one, unless `byEntry`.
 */
function step(by: 1 | -1, byEntry = false) {
  const keys = selectedColumnKeys() ?? order.value;
  if (keys.length === 0) {
    return null;
  }

  const index = selectedKey.value === null ? -1 : keys.indexOf(selectedKey.value);
  const next = index === -1 ? 0 : Math.min(Math.max(index + by, 0), keys.length - 1);
  if (index !== -1 && props.openedId != null && !byEntry) {
    return stepOpened(keys, index, next, by);
  }

  return go(keys[next] ?? null);
}

/**
 * The items `j`/`k` opened inside collapsed entries that the opened item has not caught up with yet, oldest first:
 * keys pressed faster than an item opens walk on from the last of them.
 */
const walking: string[] = [];
watch(
  () => props.openedId,
  id => {
    const caughtUp = id == null ? -1 : walking.indexOf(id);
    walking.splice(0, caughtUp === -1 ? walking.length : caughtUp + 1);
  },
);

/**
 * With an item open over the list: its pull requests one by one (D9) — through a collapsed stack's entry member by
 * member, the entry staying selected, into one from above at its first and from below at its last; an expanded one's
 * entry is passed over, its rows being its pull requests. A collapsed stack's header is walked the same way, its own
 * item first (D23); an expanded one is a row like any. On the board a stack's card, expanded or not, is walked as a
 * collapsed entry: its pull requests are inside it.
 */
function stepOpened(keys: readonly string[], index: number, next: number, by: 1 | -1) {
  const openedId = walking.at(-1) ?? props.openedId ?? null;
  const members = getWalkedMembers(keys[index]);
  const inside = openedId === null ? -1 : members.indexOf(openedId);
  const sibling = inside === -1 ? undefined : members[inside + by];
  if (sibling !== undefined) {
    return openInEntry(keys[index] ?? null, sibling);
  }

  // An expanded entry would open one of its rows out of turn: on to the row past it, or nowhere at the list's top.
  const past = next + by;
  const target = !isPassedOver(keys[next]) ? next : keys[past] === undefined ? index : past;
  const key = keys[target] ?? null;
  const entered = getWalkedMembers(key);
  const member = by === 1 ? entered[0] : entered.at(-1);
  if (target !== index && member !== undefined) {
    return openInEntry(key, member);
  }

  // Out of collapsed entries: the selected entry is what the next key steps from.
  walking.length = 0;
  return go(key);
}

/**
 * The items walked inside an entry, in order: a collapsed stack's entry's pull requests — on the board any's — and a
 * collapsed header's own item and its stack's; none for any other entry.
 */
function getWalkedMembers(key: string | null | undefined): readonly string[] {
  const current = key == null ? undefined : placed.value.get(key);
  const toggled = current && getToggled(current);
  if (!current || !toggled) {
    return [];
  }

  return current.stack && props.layout === 'board' ? current.walked : isExpanded(toggled) ? [] : current.walked;
}

/** A stack's entry in the list shown expanded: passed over by an opened item, its rows being its pull requests. */
function isPassedOver(key: string | undefined) {
  const current = key === undefined ? undefined : placed.value.get(key);
  return props.layout === 'list' && current?.stack != null && isExpanded(current.stack);
}

/** The stack an entry expands and collapses: its own, or the one it is the header of. */
function getToggled(current: Placed) {
  return current.stack ?? current.header;
}

function isExpanded(stack: ListStack) {
  return expandedStacks.has(stack.id);
}

/** Selects the entry `key` with `id`, one of the items it stands for, and opens that item. */
function openInEntry(key: string | null, id: string) {
  selectedKey.value = key;
  selectedId.value = id;
  if (id !== (walking.at(-1) ?? props.openedId)) {
    walking.push(id);
    emit('open', id);
  }

  void nextTick(scrollToSelected);
  return id;
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

/** `⇧←`/`⇧→` on the board: the selected entry into the next column that takes it — a stack's card all its pull requests. */
function moveSelected(by: 1 | -1) {
  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  if (!current || current.parent) {
    return;
  }

  for (let column = current.column + by; column >= 0 && column < props.groups.length; column += by) {
    const group = props.groups[column];
    if (group && canDrop(current.moved, current.group.key, group)) {
      emit('move', { ids: current.moved.map(entry => entry.id), from: current.group.key, to: group.key });
      return;
    }
  }
}

/** `x`: the selected entry's items in or out of the items edited together — a stack's entry all of them (D20). */
function toggleChecked() {
  const ids = currentIds();
  if (ids.length === 0) {
    return;
  }

  const checked = checkedIds.value;
  setChecked(ids.every(id => checked.includes(id)) ? checked.filter(id => !ids.includes(id)) : [...checked, ...ids]);
}

/**
 * Adds the selected entry and the one `by` away, and moves there: over a collapsed stack's entry in one step, adding all
 * its pull requests, over an expanded one row by row (D20).
 */
function extend(by: 1 | -1) {
  const before = extendedIds();
  step(by, true);
  setChecked([...checkedIds.value, ...before, ...extendedIds()]);
}

/** What `⇧J`/`⇧K` add of the selected entry: nothing of an expanded stack's entry itself, its rows being walked. */
function extendedIds() {
  return isPassedOver(selectedKey.value ?? undefined) ? [] : currentIds();
}

/**
 * `→` expands the selected stack's entry or header, `←` collapses it — or, on one of its rows, collapses it and selects
 * it. Whether it was a stack's to expand or collapse.
 */
function expandSelected(expand: boolean) {
  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  const toggled = current && getToggled(current);
  if (toggled) {
    expandedStacks.set(toggled.id, expand);
    return true;
  }

  const parent = current?.parent;
  if (!expand && parent && current.memberOf) {
    // Selected before it collapses, so the selection never sees its row go.
    selectedKey.value = parent.key;
    expandedStacks.set(current.memberOf.id, false);
    void nextTick(scrollToSelected);
    return true;
  }

  return false;
}

/** Space on the board: expands or collapses the selected stack's card; whether it was one. */
function toggleSelectedStack() {
  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  const stack = current ? getToggled(current) : null;
  if (stack) {
    toggleStack(stack);
  }

  return stack !== null;
}

function toggleStack(stack: ListStack) {
  expandedStacks.set(stack.id, !isExpanded(stack));
}

/**
 * A top-level entry and the entries shown nested under it, in order: in the list a lone nested stack's pull requests
 * under its header while expanded (D12), else each nested stack's entry one step in with its pull requests on a rail
 * below it while expanded (D23); then a stack's entry's pull requests while expanded, or a row's own nested ones. On
 * the board a stack's card lists its pull requests inside it.
 */
function placeRow(row: ListRow<T>, group: ListGroup<T>, column: number): Placed[] {
  const list = props.layout === 'list';
  const stacks = (row.stacks ?? []).flatMap(nested => (nested.stack ? [{ row: nested, stack: nested.stack }] : []));
  const header = list && stacks.length === 1 ? (stacks[0] ?? null) : null;
  const stack = row.stack ?? null;
  const ids = stack ? row.nested.map(nested => nested.id) : [row.id];
  const shown: Placed[] = [
    {
      ...base(row, null, 0),
      stack,
      header: header?.stack ?? null,
      nested: row.nested,
      ids,
      walked: header ? [row.id, ...header.row.nested.map(nested => nested.id)] : ids,
      openId: stack ? stack.open : row.id,
      moved: getMoved(row),
    },
  ];
  if (header) {
    shown.push(...placeMembers(header.row, header.stack, row, 1, true));
  } else {
    for (const nested of stacks) {
      const memberIds = nested.row.nested.map(member => member.id);
      shown.push(
        {
          ...base(nested.row, row, 1),
          stack: nested.stack,
          nested: nested.row.nested,
          ids: memberIds,
          walked: memberIds,
          openId: nested.stack.open,
        },
        ...placeMembers(nested.row, nested.stack, nested.row, 2, true),
      );
    }
  }

  if (stack) {
    shown.push(...placeMembers(row, stack, row, 1, false));
  } else {
    shown.push(...row.nested.map(nested => base(nested, row, 1)));
  }

  return shown;

  /** An entry as it is placed unless it is more. */
  function base(entry: ListEntry<T>, parent: ListRow<T> | null, depth: number): Placed {
    return {
      entry,
      group,
      column,
      parent,
      depth,
      stack: null,
      header: null,
      memberOf: null,
      rail: false,
      nested: [],
      ids: [entry.id],
      walked: [entry.id],
      openId: entry.id,
      moved: [],
    };
  }

  /** The rows of a stack's pull requests under what expands it, while it is expanded in the list. */
  function placeMembers(
    of: ListRow<T>,
    memberOf: ListStack,
    parent: ListRow<T>,
    depth: number,
    rail: boolean,
  ): Placed[] {
    if (!list || !isExpanded(memberOf)) {
      return [];
    }

    return of.nested.map(member => ({ ...base(member, parent, depth), memberOf, rail }));
  }
}

/** What a row or a card is drawn from. */
function getSlotProps(current: Placed, row: ListRow<T>, group: ListGroup<T>): ListSlotProps<T> {
  const key = current.entry.key;
  return {
    entry: current.entry,
    parent: current.parent,
    group,
    checked: isChecked(key),
    halfChecked: isHalfChecked(key),
    stack: current.stack,
    header: current.header,
    depth: current.depth,
    stackMarker: current.parent ? null : (row.stackMarker ?? null),
    nested: current.nested,
    expanded: isToggledExpanded(current),
    selectedMember: getSelectedMember(current),
    toggleStack: () => toggleOf(current),
    openMember: (id: string) => openMember(key, id),
  };
}

/** The entry's stack, or the stack it is the header of, is expanded. */
function isToggledExpanded(current: Placed) {
  const toggled = getToggled(current);
  return toggled !== null && isExpanded(toggled);
}

function toggleOf(current: Placed) {
  const toggled = getToggled(current);
  if (toggled) {
    toggleStack(toggled);
  }
}

/** On a stack's card, one of its pull requests clicked: the card selected on it, and it opened. */
function openMember(key: string, id: string) {
  selectedKey.value = key;
  selectedId.value = id;
  emit('open', id);
}

/** The pull request selected in a stack's entry, when it is the selected one. */
function getSelectedMember(current: Placed) {
  return current.stack && selectedKey.value === current.entry.key ? selectedId.value : null;
}

/** All the items the entry stands for are among those edited together. */
function isChecked(key: string) {
  const ids = placed.value.get(key)?.ids ?? [];
  return ids.length > 0 && ids.every(id => checkedIds.value.includes(id));
}

/** A stack's entry some of whose pull requests, not all, are among the items edited together. */
function isHalfChecked(key: string) {
  const current = placed.value.get(key);
  return !!current?.stack && current.ids.some(id => checkedIds.value.includes(id)) && !isChecked(key);
}

/** A row of a stack's entry shown only because another of it matches the list's filter (D3, SP25). */
function isUnmatched(current: Placed) {
  return current.memberOf?.unmatched?.has(current.entry.id) ?? false;
}

/** In the list's order, each once. */
function setChecked(ids: readonly string[]) {
  const wanted = new Set(ids);
  checkedIds.value = listedIds.value.filter(id => wanted.has(id));
}

function openEntry(key: string) {
  select(key);
  const id = placed.value.get(key)?.openId ?? null;
  if (id !== null) {
    emit('open', id);
  }
}

/**
 * Selects the entry; returns its item's id — on a stack's entry or header the selected item when it is one of its,
 * else the one Enter opens.
 */
function select(key: string | null) {
  const current = key === null ? undefined : placed.value.get(key);
  const kept = selectedId.value;
  const inside = kept !== null && !!current && getToggled(current) !== null && current.walked.includes(kept);
  const id = inside ? kept : (current?.openId ?? null);
  selectedKey.value = key;
  selectedId.value = id;
  return id;
}

/**
 * The items the selected entry stands for — read from the entry, as the model given by the owner changes only once it
 * re-renders.
 */
function currentIds(): readonly string[] {
  const key = selectedKey.value;
  if (key === null) {
    return selectedId.value === null ? [] : [selectedId.value];
  }

  return placed.value.get(key)?.ids ?? [];
}

/** The item Enter opens for the selected entry. */
function currentOpenId() {
  const key = selectedKey.value;
  return key === null ? selectedId.value : (placed.value.get(key)?.openId ?? null);
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

/** What moving a row moves (D3): the row itself, or a stack's entry's pull requests. */
function getMoved(row: ListRow<T>): readonly ListEntry<T>[] {
  return row.stack ? row.nested : [row];
}

function isDraggable(row: ListRow<T>, group: ListGroup<T>) {
  return props.layout === 'board' && props.groups.some(other => canDrop(getMoved(row), group.key, other));
}

/** Whether the group takes what is moved: every entry of it, so a stack's card moves whole or not at all. */
function canDrop(moved: readonly ListEntry<T>[], from: string, group: ListGroup<T>) {
  return (
    group.droppable &&
    group.key !== from &&
    moved.length > 0 &&
    moved.every(entry => props.canMove(entry, from, group.key))
  );
}

function startDrag(event: DragEvent, row: ListRow<T>, group: ListGroup<T>) {
  const moved = getMoved(row);
  dragged.value = { key: row.key, moved, from: group.key };
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', moved.map(entry => entry.id).join('\n'));
  }
}

function dragOver(event: DragEvent, group: ListGroup<T>) {
  const drag = dragged.value;
  if (drag && canDrop(drag.moved, drag.from, group)) {
    event.preventDefault();
    dropTarget.value = group.key;
  }
}

function drop(event: DragEvent, group: ListGroup<T>) {
  const drag = dragged.value;
  endDrag();
  if (drag && canDrop(drag.moved, drag.from, group)) {
    event.preventDefault();
    select(drag.key);
    emit('move', { ids: drag.moved.map(entry => entry.id), from: drag.from, to: group.key });
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
  const current = key === undefined ? undefined : placed.value.get(key);
  if (key === undefined || !current) {
    event.stopImmediatePropagation();
    return;
  }

  const checked = checkedIds.value;
  if (checked.length > 1 && current.ids.every(id => checked.includes(id))) {
    menuIds.value = checked;
    menuOpenId.value = null;
    return;
  }

  menuIds.value = current.ids;
  menuOpenId.value = current.openId;
  select(key);
}

function openFromMenu() {
  if (menuOpenId.value !== null) {
    emit('open', menuOpenId.value);
  }
}

/** The item's own entry, else the stack's entry or header it is in. */
function findKey(keys: readonly string[], id: string) {
  return (
    keys.find(key => placed.value.get(key)?.entry.id === id) ??
    keys.find(key => placed.value.get(key)?.walked.includes(id)) ??
    null
  );
}

/** The row of the item nested under the entry `parentKey`. */
function isNestedRowOf(key: string, parentKey: string, id: string) {
  const current = placed.value.get(key);
  return current?.parent?.key === parentKey && current.entry.id === id;
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
                  v-for="current in shownByRow.get(row.key)"
                  :key="current.entry.key"
                  :class="[
                    css.listView_row,
                    current.rail && css[`listView_row_rail${current.depth}`],
                    selectedKey === current.entry.key && css.listView_row_selected,
                    isChecked(current.entry.key) && css.listView_row_checked,
                    isUnmatched(current) && css.listView_row_unmatched,
                  ]"
                  :aria-current="selectedKey === current.entry.key ? 'true' : undefined"
                  :data-entry-key="current.entry.key"
                  @click="openEntry(current.entry.key)"
                >
                  <!-- In the row's gutter (SP10, SP20, SP22); toggling it opens nothing. -->
                  <button
                    v-if="getToggled(current)"
                    type="button"
                    tabindex="-1"
                    :class="[css.listView_stackToggle, current.depth > 0 && css.listView_stackToggle_nested]"
                    :aria-expanded="isToggledExpanded(current)"
                    :aria-label="t(isToggledExpanded(current) ? l.collapseStack : l.expandStack)"
                    @click.stop="toggleOf(current)"
                  >
                    <component
                      :is="isToggledExpanded(current) ? ChevronDown : ChevronRight"
                      aria-hidden="true"
                    />
                  </button>
                  <slot
                    name="row"
                    v-bind="getSlotProps(current, row, group)"
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
                v-for="current in shownByRow.get(row.key)"
                :key="current.entry.key"
                :class="[
                  css.listView_card,
                  current.parent && css.listView_card_nested,
                  selectedKey === current.entry.key && css.listView_card_selected,
                  isChecked(current.entry.key) && css.listView_card_checked,
                  dragged?.key === current.entry.key && css.listView_card_dragged,
                ]"
                :aria-current="selectedKey === current.entry.key ? 'true' : undefined"
                :data-entry-key="current.entry.key"
                :draggable="!current.parent && isDraggable(row, group) ? 'true' : undefined"
                @click="openEntry(current.entry.key)"
                @dragstart="startDrag($event, row, group)"
                @dragend="endDrag"
              >
                <slot
                  name="card"
                  v-bind="getSlotProps(current, row, group)"
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
  position: relative;
  cursor: default;

  &:hover {
    background: $color-bg-2;
  }
}

// A stack's pull requests under an issue (D12, D23): a rail below the icon of what expands them — the issue's, or a
// nested stack's header's (`ItemRow`, `StackRow`: 16px and 42px in, icons 15px wide).
.listView_row_rail1::before,
.listView_row_rail2::before {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  content: '';
  background: $color-border-2;
}

.listView_row_rail1::before {
  left: $spacing-16 + 7px;
}

.listView_row_rail2::before {
  left: 42px + 7px;
}

// In the 16px gutter left of the row's icon, level with it: the row's padding and the icon's own offset.
.listView_stackToggle {
  position: absolute;
  top: $spacing-7 + $spacing-2;
  left: calc(($spacing-16 - 14px) / 2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  color: $color-fg-3;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg-2;
  }

  svg {
    width: 12px;
    height: 12px;
  }
}

// A nested stack's header (D23): in the gutter left of its icon, 42px in.
.listView_stackToggle_nested {
  left: calc(42px - $spacing-16 + ($spacing-16 - 14px) / 2);
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

.listView_row_unmatched > * {
  opacity: 0.4;
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
