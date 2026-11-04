<!-- The body of every list (D9) — my work, a repository, a project — as List or Board, over groups its owner built. List: each group a section with its header (collapsible) and rows; a group still on its way says so (G7). Board: each group a column with its head and count, cards top to bottom. Rows and cards are the owner's (`row`, `card` slots), and so is what follows a group (`groupFooter`) and, in the list, all of them (`end`); the list draws them, their selection and the keys. The selected entry is kept by key: when the list changes under it (a sync, an edit) it stays on its entry, follows its item into another group, or moves to the neighbour when its item leaves. `j`/`k` or ↓/↑ move it — on the board within the column, ←/→ to the next column — Enter or a click opens it (an opened item follows the selection), `o` opens it on GitHub, `⇧M` the merge panel for a pull request the viewer may merge, the selected one while nothing is checked or the one checked alone, never several (merging D9) — as its row's "Merge" and its context menu do — and once the merge is sent it is unchecked and the selection moves on to the next row (PM32a). `x` adds it to the items edited together (or takes it out), `⇧↓`/`⇧↑` (`⇧J`/`⇧K`) move on adding, Escape empties them. Right-clicking an entry opens its owner's context menu (`contextMenu`, L1–L4) for the items edited together when it is one of them, else for it alone, which it selects; elsewhere the browser's own menu shows. On the board an entry its owner lets move is dragged to another column or moved with `⇧←`/`⇧→`: `move` asks the owner to set the column's value of each item it moves — a stack's card all its pull requests, and only when each may move (D3). A stack's entry (a row with `stack`, D2, D3) stands for its pull requests in its group — a share of the stack's open ones when they are spread over groups (D16), never the others: collapsed until expanded — a chevron in its gutter, `→`/`←`, `←` on one of its rows selecting it — for the session and in every list (`ExpandedStacks`, D10); Enter opens the pull request it names (D9), and `j`/`k` walk the same steps with an item open or not (D26): a collapsed entry is one step, an expanded one a step and each of its rows another; `x` and the context menu take all its pull requests (D20), and `⇧J`/`⇧K` cross it in one step adding them all — an expanded one row by row — the entry half marked while only some of them are taken (`halfChecked`). Under a filter its rows not matching are de-emphasised (`ListStack.unmatched`, SP25). Stacks' entries may be nested under a row (`ListRow.stacks`, my work's stacks closing an assigned issue: D12, D23): in the list a lone one makes the row its header — the row takes the stack's chevron, `→`/`←` and expanded state, its pull requests are the row's rows, on a rail; Enter and `x` are the row's own item's — while two or more are entries one step in, each with its pull requests on a rail below it; on the board each is a nested card. On the board it is one card (SP26, SP27), `j`/`k` stepping over it as over any: expanded — its chevron, or Space, as ←/→ step between columns there — it lists its pull requests inside it (the owner's card draws them, from `expanded`, `selectedMember`, `toggleStack` and `openMember`), each a step after the card. The list hands over what it shows as `listed` — all its items, a stack's pull requests one by one, collapsed or not, and the steps an opened item takes — and an item opened inside a collapsed entry keeps the entry selected. An opened item leaving the list through the user's own edit moves the selection on, and the next one opens in its place; leaving any other way (a sync, a filter) it stays open with no row selected, and the next step goes to where it stood. With nothing checked and no item open, the command menu and the keys act on the selected row, with the actions of its context menu. While an item is open over the list, an entry that can't open there (`canOpenOver`, a project's draft) is passed over by the keys and by every move of the list's own, as if it weren't there, and a click still opens it. An Undo of a close brings the cursor, and an open panel or modal, back to the undone item (`useItemList`, D29). -->
<script lang="ts" setup generic="T">
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext, provideContext } from '@nzyme/vue-utils/context.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { ChevronDown, ChevronRight, GitMerge, Loader } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue';

import type { Command, CommandSubject } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import { EDIT_KEYS } from '@/commands/useEditCommands.js';
import { PULL_REQUEST_COMMAND_KEYS, usePullRequestCommands } from '@/commands/usePullRequestCommands.js';
import Button from '@/components/Button.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import { usePullRequestVerdicts } from '@/item/usePullRequestVerdict.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { formatShortReference } from '@/item/itemRoutes.js';
import { isAutoMergeAllowed } from '@/merge/isAutoMergeAllowed.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { MergeContext } from '@/merge/MergeContext.js';
import { getStackMerge } from '@/merge/stack/getStackMerge.js';
import { getStackMergeEnd } from '@/merge/stack/getStackMergeEnd.js';
import { Browser } from '@/services/Browser.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { followSelection } from '@/utils/followSelection.js';
import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenKey } from '@/utils/isScreenKey.js';
import { takeFocusOffControl } from '@/utils/takeFocusOffControl.js';

import { ExpandedStacks } from './ExpandedStacks.js';
import ListGroupMarker from './ListGroupMarker.vue';
import type {
  ListContextMenuProps,
  ListEntry,
  ListGroup,
  ListLayout,
  ListedItems,
  ListedNeighbours,
  ListMove,
  ListRow,
  ListStack,
} from './ListTypes.js';
import * as l from './ListView.loc.js';
import { useItemCommands } from './useItemCommands.js';

/** What the list leaves to an item opened in a modal over it. */
const MODAL_KEYS: ReadonlySet<string> = new Set(['j', 'k', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']);

/** A row's action keys the list handles itself, below: a context menu draws them, the registry must not run them. */
const OWN_KEYS: ReadonlySet<string> = new Set(['Enter', 'O']);

/** The keys of a pull request's ordinary commands, which a stack's entry doesn't take (D11). */
const ORDINARY_KEYS: ReadonlySet<string> = new Set(Object.values(PULL_REQUEST_COMMAND_KEYS));

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
    /** The user has an edit of the item on its way: it leaving the list is their doing, and the opened item moves on. */
    isEdited?: (id: string) => boolean;
    /** Whether the entry can open over the list in the opened item's place; a project's draft has its own dialog instead. */
    canOpenOver?: (value: T) => boolean;
  }>(),
  { openedId: null, getUrl: () => null, canMove: () => false, isEdited: () => false, canOpenOver: () => true },
);

const emit = defineEmits<{
  /** Enter or a click on an entry, or the selection moved while an item is open. */
  open: [id: string];
  /** The items the list shows, and what an opened item steps through; again as the cursor moves. */
  listed: [listed: ListedItems];
  /** An entry was dropped into another group, or moved there with `⇧←`/`⇧→`. */
  move: [move: ListMove];
}>();

/** The selected item's id; on a stack's entry, the pull request Enter opens or the one opened inside it. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`), in the list's order — never a stack entry's own id. */
const checkedIds = defineModel<readonly string[]>('checkedIds', { default: () => [] });

const slots = defineSlots<{
  /** A row of the list: an entry, or one nested under `parent`. */
  row(props: ListSlotProps<T>): unknown;
  /** A card of the board. */
  card(props: ListSlotProps<T>): unknown;
  /** No groups at all. */
  empty?(): unknown;
  /**
   * In the list, after all its groups, unless all are collapsed: with no rows to scroll past, it would always be in
   * reach. None on the board, whose columns scroll on their own.
   */
  end?(): unknown;
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
  /** The list's selection is on it. */
  selected: boolean;
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
  /** On a stack's card, the pull request of it the selection is on; else `null`. */
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
  /** Set on a stack's pull request, a row of the list or a step inside its card on the board: its stack. */
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

/** What `⇧M` merges: one pull request, or — `entry` set — that stack's entry's whole stack (stacked PRs D11). */
interface MergeTarget {
  readonly id: string;
  readonly entry: Placed | null;
}

/** A top-level entry to place, in its group. */
interface PlaceRowParams {
  readonly row: ListRow<T>;
  readonly group: ListGroup<T>;
  /** On the board, the group's column. */
  readonly column: number;
}

/** An entry to place as it is unless it is more, under its row. */
interface BaseParams {
  readonly entry: ListEntry<T>;
  readonly parent: ListRow<T> | null;
  readonly depth: number;
}

/** A stack's pull requests to place under what expands them. */
interface PlaceMembersParams {
  /** The entry whose `nested` they are. */
  readonly of: ListRow<T>;
  readonly memberOf: ListStack;
  readonly parent: ListRow<T>;
  readonly depth: number;
  /** On a rail below what expands them (D12, D23). */
  readonly rail: boolean;
}

/** The entry a row or a card is drawn for, and the top-level row and group it is under. */
interface GetSlotPropsParams {
  readonly current: Placed;
  readonly row: ListRow<T>;
  readonly group: ListGroup<T>;
}

/** The opened item gone from the list, and the selection on `key`, which stood for it. */
interface LeaveOpenedParams {
  readonly opened: string;
  readonly key: string;
  readonly previous: readonly string[];
  readonly next: readonly string[];
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
const navigation = useService(ItemNavigation);
const bodyRef = useTemplateRef<HTMLElement>('body');
const collapsed = ref<ReadonlySet<string>>(new Set());
const selectedKey = ref<string | null>(null);
/**
 * Where in `order` the opened item stood when it left the list other than by the user's edit: no row is selected, the
 * opened item stays and this is what its next step goes from. `null` as soon as the selection is on a row.
 */
const leftIndex = ref<number | null>(null);
const dragged = shallowRef<Dragged | null>(null);
const dropTarget = ref<string | null>(null);
const menuIds = shallowRef<readonly string[]>([]);
/** The item the context menu's "Open" opens; `null` when it is for several. */
const menuOpenId = ref<string | null>(null);
/** The context menu's merge of a stack's entry right-clicked, whole (stacked PRs D11); `null` otherwise. */
const menuMerge = shallowRef<Command | null>(null);
/** Merging, where the screen offers it (merging D9). */
const merging = injectContext(MergeContext, { optional: true });
const pullRequestCommands = usePullRequestCommands();
// Where the screen merges, the app's local copy is there: ⇧M's title reads the pull request's way forward from it.
const items = merging ? useService(ItemStore) : null;
const getVerdict = usePullRequestVerdicts();
const repositories = merging ? useService(RepositoryStore) : null;

/** Each top-level entry and those shown nested under it, in order, by the entry's key. */
const shownByRow = computed(() => {
  const shown = new Map<string, Placed[]>();
  for (const [column, group] of props.groups.entries()) {
    for (const row of group.rows) {
      shown.set(row.key, placeRow({ row, group, column }));
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
/** On the board, the keys of each column top to bottom, an expanded card's pull requests after it. */
const columns = computed(() => {
  const keys: string[][] = props.groups.map(() => []);
  for (const [key, { column }] of placed.value) {
    keys[column]?.push(key);
  }

  return keys;
});
const listedIds = computed(() => [...new Set([...placed.value.values()].flatMap(({ walked }) => walked))]);
/** Kept apart from `around`, so a cursor move hands over the same `steps` and `stepOf`. */
const stepped = computed(() => {
  const openable = [...placed.value.values()].filter(({ entry }) => props.canOpenOver(entry.value));
  const steps = new Set<string>();
  for (const { stack, openId } of openable) {
    if (!stack || !isExpanded(stack)) {
      steps.add(openId);
    }
  }

  const stepOf = new Map<string, string>();
  for (const { walked, openId } of openable) {
    for (const id of walked) {
      if (!steps.has(id) && !stepOf.has(id)) {
        stepOf.set(id, openId);
      }
    }
  }

  return { steps: [...steps], stepOf };
});
/** What `step` moves to from the cursor, as it does: on the board within the column. */
const around = computed((): ListedNeighbours | null => {
  if (leftIndex.value !== null) {
    return { previous: getOpenId(getLeftKey(-1)), next: getOpenId(getLeftKey(1)) };
  }

  const keys = selectedColumnKeys() ?? order.value;
  const index = selectedKey.value === null ? -1 : keys.indexOf(selectedKey.value);
  return index === -1
    ? null
    : { previous: getOpenId(findStep(keys, index, -1)), next: getOpenId(findStep(keys, index, 1)) };
});
/**
 * The row the keys act on: the cursor's, its own items as a row of the list has them, also on the board inside a card;
 * none with items checked or an item open, whose own the keys then are.
 */
const cursorRow = computed(() => {
  const key = selectedKey.value;
  return key !== null && checkedIds.value.length === 0 && props.openedId == null ? placed.value.get(key) : undefined;
});
// Where the row has a context menu, the same actions on its keys (no `merge`: `⇧M` is the list's, `getMergeCommands`).
const rowActions = slots.contextMenu
  ? useItemCommands({
      ids: () => cursorRow.value?.ids ?? [],
      section: () => (cursorRow.value?.stack ? 'selection' : 'item'),
      open: () => {
        const id = currentOpenId();
        if (id !== null) {
          emit('open', id);
        }
      },
    })
  : null;
/** What the cursor row's actions act on; none for a project's draft, which the local copy does not know. */
const rowSubject = computed((): CommandSubject | null => {
  const [item] = rowActions?.selected.value ?? [];
  if (!item) {
    return null;
  }

  if (cursorRow.value?.stack) {
    const chip = t(l.pullRequests, { count: rowActions?.selected.value.length ?? 0 });
    return { kind: 'selection', label: chip, title: chip };
  }

  return { kind: 'item', label: formatShortReference(item), title: item.title };
});
const listed = computed((): ListedItems => ({ all: listedIds.value, ...stepped.value, around: around.value }));
/** The selected entry; on the board, on a pull request inside a card, that card, which is what is drawn and moved. */
const selectedCard = computed(() => (selectedKey.value === null ? undefined : getCard(selectedKey.value)));

/**
 * The items steps opened that the opened item has not caught up with yet, oldest first: the address follows them one
 * by one, each writing its item back as the selected one, while the keys are ahead of it.
 */
const opening: string[] = [];
watch(
  () => props.openedId,
  id => {
    const caughtUp = id == null ? -1 : opening.indexOf(id);
    opening.splice(0, caughtUp === -1 ? opening.length : caughtUp + 1);

    // Closed with no row selected: the selection comes back where the item stood.
    if (id == null && leftIndex.value !== null) {
      select(getLeftKey(1) ?? null);
      leftIndex.value = null;
    }
  },
);
watch(
  selectedKey,
  key => {
    if (key !== null) {
      leftIndex.value = null;
    }
  },
  { flush: 'sync' },
);

// The selection given from outside (an item opened by its address, a toast's request, `J` in an opened item) lands on
// the item's first entry — a collapsed stack's entry or header for one of its pull requests; one already on that item
// stays where it is. On an expanded stack's entry or header, another of its pull requests moves it onto that one's row.
watch(
  selectedId,
  id => {
    // The address catching up with an older step: the selection stays where the keys took it.
    if (id !== null && id === props.openedId && opening.length > 0 && id !== opening.at(-1)) {
      return;
    }

    const key = selectedKey.value;
    const current = key === null ? undefined : placed.value.get(key);
    const toggled = current && getToggled(current);
    if (key === null || id === null || !current?.walked.includes(id)) {
      selectedKey.value = id === null ? null : findKey(order.value, id);
    } else if (toggled && id !== current.openId && expandedStacks.has(toggled.id)) {
      selectedKey.value = order.value.find(other => isNestedRowOf(other, key, id)) ?? key;
    }

    if (selectedKey.value !== key) {
      void nextTick(scrollToSelected);
    }
  },
  { immediate: true },
);

watch([order, listedIds], ([next, ids], [previous, previousIds]) => {
  const key = selectedKey.value;
  // What the keys opened last, as the address lags behind them: only its leaving is the selection's to follow.
  const opened = opening.at(-1) ?? props.openedId;
  if (
    key !== null &&
    opened != null &&
    opened === selectedId.value &&
    previousIds.includes(opened) &&
    !ids.includes(opened)
  ) {
    leaveOpened({ opened, key, previous, next });
  } else if (key === null && selectedId.value !== null) {
    // Selected before its item was listed (the copy still loading): it is selected once it is.
    selectedKey.value = findKey(next, selectedId.value);
  } else if (key !== null && !next.includes(key)) {
    // Its item moved into another group (an edit, a sync): the selection goes with it.
    const id = selectedId.value;
    const moved = id === null ? null : findKey(next, id);
    select(moved ?? followSelection(previous, next, key));
  }

  // An item that left the list (closed) leaves the items edited together.
  if (checkedIds.value.some(id => !ids.includes(id))) {
    checkedIds.value = checkedIds.value.filter(id => ids.includes(id));
  }
});
watch(listed, value => emit('listed', value), { immediate: true });
// Gone from a screen that stays (a repository's Commits), it has no cursor to step from.
onBeforeUnmount(() => emit('listed', { ...listed.value, around: null }));

// A merge sent from the opened item moves on at once, as one sent from here (PM32a): the row leaves only once it lands.
watch(
  () => navigation.moveOnRequest,
  request => {
    if (request) {
      checkedIds.value = checkedIds.value.filter(id => !request.merged.includes(id));
      moveOpenedOn(request.merged);
    }
  },
);

// The rows and the context menu merge through the list: their entry is selected, and once the merge is sent the list
// moves on to the next row (PM32a) — past a stack's entry merged whole (SP7).
if (merging) {
  provideContext(MergeContext, {
    canOpen: id => merging.canOpen(id),
    open: (id, options) => mergeFromList({ id, entry: options?.wholeStack ? findStackEntry(id) : null }),
    getRecord: id => merging.getRecord(id),
    getCommands: id => merging.getCommands(id),
    run: (id, command) => merging.run(id, command),
  });
}

// The list's keys are its own — handled below, before an opened item's — and listed in the help sheet; "Merge…" of
// the selected row first, as the command menu offers it (PM39).
useCommands(
  () => [...getMergeCommands(), ...getRowCommands(), ...getKeyCommands()],
  () => rowSubject.value,
);

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

  // Over a modal they are the opened item's: its `j`/`k` step through the list, the arrows scroll it.
  if (props.openedId != null && navigation.listArrangement === 'modal' && MODAL_KEYS.has(event.key)) {
    return;
  }

  switch (event.key) {
    case 'x':
      if (toggleChecked()) {
        event.preventDefault();
      }

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
      if (openSelectedOnGitHub()) {
        event.preventDefault();
      }

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

/**
 * `⇧M` "Merge…" (merging D9): of the selected row while nothing is checked, or of one pull request checked alone — the
 * selection's, ahead of an opened item's — never of several, which are never merged together; on a stack's entry, its
 * whole stack (stacked PRs D11). The list owns both: once the merge is sent, the merged ones are unchecked and the
 * selection moves past them (PM32a, SP7).
 */
function getMergeCommands(): Command[] {
  if (!merging) {
    return [];
  }

  const selection = checkedIds.value.length > 0;
  const target = getMergeTarget();
  return [
    {
      id: selection ? 'selection.merge' : 'list.merge',
      title: target ? getMergeTitle(target) : t(l.merge),
      section: selection ? 'selection' : (rowSubject.value?.kind ?? 'view'),
      key: EDIT_KEYS.merge,
      icon: GitMerge,
      actsOnRow: true,
      when: () => getMergeTarget() !== null,
      run: () => {
        const current = getMergeTarget();
        if (current) {
          mergeFromList(current);
        }
      },
    },
  ];
}

/**
 * What the cursor row's context menu offers, by the keys it draws but those the list handles itself; on a stack's entry
 * of a pull request's ordinary commands only `⇧Q`, which takes the stack out whole through its first one (D11).
 */
function getRowCommands(): Command[] {
  if (!rowActions || !rowSubject.value) {
    return [];
  }

  const commands = [...rowActions.getEditCommands(), ...rowActions.getOwnCommands()].map(command =>
    command.key !== undefined && OWN_KEYS.has(command.key) ? { ...command, key: undefined } : command,
  );
  return cursorRow.value?.stack
    ? [...commands.filter(command => !ORDINARY_KEYS.has(command.key ?? '')), ...getStackDequeue()]
    : commands;
}

/** `⇧Q` of a stack's entry, through the first of its pull requests in the queue. */
function getStackDequeue(): Command[] {
  const queued = rowActions?.selected.value.find(item => item.kind === 'pullRequest' && item.mergeQueueEntry);
  return merging && queued?.kind === 'pullRequest'
    ? pullRequestCommands({ section: 'selection', pr: queued, source: merging }).filter(
        command => command.key === EDIT_KEYS.dequeue,
      )
    : [];
}

/**
 * What `⇧M` merges: the pull request checked alone, else — nothing checked — the selected row's; on a stack's entry
 * its whole stack, unless one of its pull requests is open over the list: `⇧M` is then the opened one's, everything up
 * to it (stacked PRs D11, SP6).
 */
function getMergeTarget(): MergeTarget | null {
  const checked = checkedIds.value;
  if (checked.length > 0) {
    const [id] = checked;
    return checked.length === 1 && id !== undefined && merging?.canOpen(id) ? { id, entry: null } : null;
  }

  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  if (current?.stack) {
    return props.openedId != null && current.walked.includes(props.openedId) ? null : getStackTarget(current);
  }

  const [id] = current?.ids.length === 1 ? current.ids : [];
  return id !== undefined && merging?.canOpen(id) ? { id, entry: null } : null;
}

/** The whole stack of a stack's entry, opened on the first of its pull requests the panel opens for. */
function getStackTarget(entry: Placed): MergeTarget | null {
  const id = entry.ids.find(candidate => merging?.canOpen(candidate));
  return id === undefined ? null : { id, entry };
}

/** The stack's entry standing for the pull request, for its whole stack's merge; `null` when none lists it. */
function findStackEntry(id: string): Placed | null {
  return [...placed.value.values()].find(current => current.stack && current.walked.includes(id)) ?? null;
}

/**
 * The way forward the panel leads to, before its read (PM38): the pull request's, as its standing says it; a stack's,
 * as the panel opening on it would — "Merge all 3", "Merge 2" up to the one holding the rest, "Queue…" on a merge
 * queue's branch, "In the queue" once there, "Rebase on GitHub", "Mark #102 ready…" (stacked PRs D11, SP15, SP45–SP49,
 * SP53, SP54).
 */
function getMergeTitle(target: MergeTarget): string {
  const description = target.entry?.stack?.description;
  if (description) {
    return getStackMergeTitle(description);
  }

  const pr = items?.get(target.id);
  if (pr?.kind !== 'pullRequest') {
    return t(l.merge);
  }

  const autoMergeAllowed = isAutoMergeAllowed(repositories?.get(pr.repository.nameWithOwner) ?? null, null);
  return getVerdict({ pr, checks: null, autoMergeAllowed }).forwardTitle;
}

function getStackMergeTitle(description: StackDescription): string {
  switch (description.state.kind) {
    case 'merging':
      return t(l.merge);
    case 'queued':
      return t(l.inQueue);
    default:
      break;
  }

  const end = getStackMergeEnd({ description, openedOn: null });
  const { block, going, holder, open } = getStackMerge({ description, end });
  switch (block?.kind) {
    case undefined:
      if (open[0]?.isMergeQueueEnabled) {
        return t(l.queue);
      }

      if (going.length <= 1) {
        return t(l.merge);
      }

      return going.length === open.length
        ? t(l.mergeStack, { count: going.length })
        : t(l.mergeStackPart, { count: going.length });
    case 'needsRebase':
      return t(l.rebaseOnGitHub);
    case 'held':
      return holder?.kind === 'draft' ? t(l.markReady, { number: holder.number }) : t(l.merge);
    case 'incomplete':
    case 'closed':
      return t(l.merge);
    default:
      return assertNever(block);
  }
}

/**
 * The opened item left the list. By the user's edit the selection goes on, and the item opened with it: to what the
 * entry now opens when one of a stack's entry's pull requests left and the entry stays, else to what stands in its place
 * or, at the end, before it. Any other way (a sync, a filter, a collapsed group), or with nothing left, the item stays
 * open and no row is selected until a step, its row coming back, or closing it.
 */
function leaveOpened({ opened, key, previous, next }: LeaveOpenedParams) {
  const before = previous.slice(0, previous.indexOf(key)).findLast(other => next.includes(other));
  const place = before === undefined ? 0 : next.indexOf(before) + 1;
  const target = next.includes(key)
    ? key
    : (next.slice(place).find(opensOver) ?? next.slice(0, place).findLast(opensOver));
  selectedKey.value = null;
  if (props.isEdited(opened) && target !== undefined) {
    go(target);
  } else {
    leftIndex.value = place;
  }
}

/**
 * Opens the merge panel for the pull request — or a stack's entry's whole stack — with its entry selected, an item open
 * following; once the
 * merge is sent they leave the items edited together, and the list moves on to the next row: past a stack's entry and
 * its rows (SP7).
 */
function mergeFromList({ id, entry }: MergeTarget) {
  const key = entry ? entry.entry.key : findKey(order.value, id);
  if (key !== null) {
    go(key);
  }

  const chosen = entry ? entry.ids : [id];
  merging?.open(id, {
    wholeStack: entry !== null,
    onSent: sent => {
      // What it took: a row of a stack merges everything up to it.
      const merged = [...chosen, ...sent];
      checkedIds.value = checkedIds.value.filter(other => !merged.includes(other));
      if (props.openedId != null) {
        moveOpenedOn(merged);
      } else if (entry?.stack) {
        stepPast(entry.entry.key, merged);
      } else {
        step(1);
      }
    },
  });
}

/**
 * To the first entry after `key` not all merged: past a stack's entry and its rows; it stays put when none follows.
 * Whether one did.
 */
function stepPast(key: string, merged: readonly string[]) {
  const keys = selectedColumnKeys() ?? order.value;
  const index = keys.indexOf(key);
  const next = keys.slice(index + 1).find(other => isStep(other) && !isAllMerged(other, merged));
  if (index === -1 || next === undefined) {
    return false;
  }

  go(next);
  return true;
}

/** A merge sent with an item open moves it on at once (PM32a): to the next entry not all merged, else the previous one. */
function moveOpenedOn(merged: readonly string[]) {
  const key = selectedKey.value;
  if (key === null) {
    step(1);
  } else if (!stepPast(key, merged)) {
    const keys = selectedColumnKeys() ?? order.value;
    const previous = keys
      .slice(0, Math.max(keys.indexOf(key), 0))
      .findLast(other => isStep(other) && !isAllMerged(other, merged));
    if (previous !== undefined) {
      go(previous);
    }
  }
}

function isAllMerged(key: string, merged: readonly string[]) {
  return placed.value.get(key)?.walked.every(id => merged.includes(id)) ?? false;
}

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
 * Moves the selection `by` steps of what the list shows — on the board within its column; `overCards` from card to card,
 * past the pull requests inside them.
 */
function step(by: 1 | -1, overCards = false) {
  if (leftIndex.value !== null) {
    go(getLeftKey(by) ?? null);
    return;
  }

  const shown = selectedColumnKeys() ?? order.value;
  const keys = overCards ? shown.filter(key => placed.value.get(key) === getCard(key)) : shown;
  if (keys.length === 0) {
    return;
  }

  const key = overCards ? (selectedCard.value?.entry.key ?? null) : selectedKey.value;
  const index = key === null ? -1 : keys.indexOf(key);
  const target = index === -1 ? keys.find(isStep) : findStep(keys, index, by);
  go(target ?? key);
}

/** The nearest of `keys` the cursor may step to on the `by` side of `index`. */
function findStep(keys: readonly string[], index: number, by: 1 | -1) {
  return by === 1 ? keys.slice(index + 1).find(isStep) : keys.slice(0, index).findLast(isStep);
}

/** With an item open the cursor only steps to what opens in its place; with none, to any entry. */
function isStep(key: string) {
  return props.openedId == null || opensOver(key);
}

function opensOver(key: string) {
  const current = placed.value.get(key);
  return !!current && props.canOpenOver(current.entry.value);
}

/**
 * With no row selected after the opened item left: what stands where it stood, or `by` -1 before that, else on the other
 * side. Only what could open over the list, also as the item closes.
 */
function getLeftKey(by: 1 | -1) {
  const place = leftIndex.value ?? 0;
  const before = order.value.slice(0, place).findLast(opensOver);
  const after = order.value.slice(place).find(opensOver);
  return by === 1 ? (after ?? before) : (before ?? after);
}

function getOpenId(key: string | undefined) {
  return (key === undefined ? undefined : placed.value.get(key)?.openId) ?? null;
}

/** The stack an entry expands and collapses: its own, or the one it is the header of. */
function getToggled(current: Placed) {
  return current.stack ?? current.header;
}

function isExpanded(stack: ListStack) {
  return expandedStacks.has(stack.id);
}

/** On the board: to the entry at the same height in the next column that has any. */
function stepColumn(by: 1 | -1) {
  const current = selectedCard.value;
  if (!current) {
    step(1);
    return;
  }

  const index = getColumnCards(current.column).indexOf(current.entry.key);
  for (let column = current.column + by; column >= 0 && column < columns.value.length; column += by) {
    const keys = getColumnCards(column).filter(isStep);
    if (keys.length > 0) {
      go(keys[Math.min(index, keys.length - 1)] ?? null);
      return;
    }
  }
}

/** The keys of a column's cards, without the pull requests inside them. */
function getColumnCards(column: number) {
  return (columns.value[column] ?? []).filter(key => placed.value.get(key) === getCard(key));
}

/** On the board, the keys of the selected entry's column; `null` in the list or with nothing selected. */
function selectedColumnKeys() {
  const key = selectedKey.value;
  const current = props.layout === 'board' && key !== null ? placed.value.get(key) : undefined;
  return current ? (columns.value[current.column] ?? null) : null;
}

/**
 * Moves the selection onto the step: its item, the one Enter opens on a stack's entry, opens in place of the opened one.
 * Past either end of the list it stays where it is, on the item open inside its entry too.
 */
function go(key: string | null) {
  takeFocusOffControl();
  if (key !== selectedKey.value) {
    const id = key === null ? null : (placed.value.get(key)?.openId ?? null);
    selectedKey.value = key;
    selectedId.value = id;
    if (id !== null && props.openedId != null && id !== (opening.at(-1) ?? props.openedId)) {
      opening.push(id);
      emit('open', id);
    }
  }

  void nextTick(scrollToSelected);
}

/** `⇧←`/`⇧→` on the board: the selected entry into the next column that takes it — a stack's card all its pull requests. */
function moveSelected(by: 1 | -1) {
  const current = selectedCard.value;
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

/**
 * `x`: the selected entry's items in or out of the items edited together — a stack's entry all of them (D20). Whether
 * there were any.
 */
function toggleChecked() {
  const ids = currentIds();
  if (ids.length === 0) {
    return false;
  }

  const checked = checkedIds.value;
  setChecked(ids.every(id => checked.includes(id)) ? checked.filter(id => !ids.includes(id)) : [...checked, ...ids]);
  return true;
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
  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  return props.layout === 'list' && current?.stack && isExpanded(current.stack) ? [] : currentIds();
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
  const card = selectedCard.value;
  const stack = card ? getToggled(card) : null;
  if (card && stack) {
    // Selected before it collapses, so the selection never sees its pull request go.
    selectedKey.value = card.entry.key;
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
 * the board an expanded card's pull requests are steps too, drawn inside it.
 */
function placeRow({ row, group, column }: PlaceRowParams): Placed[] {
  const list = props.layout === 'list';
  const stacks = (row.stacks ?? []).flatMap(nested => (nested.stack ? [{ row: nested, stack: nested.stack }] : []));
  const header = list && stacks.length === 1 ? (stacks[0] ?? null) : null;
  const stack = row.stack ?? null;
  const ids = stack ? row.nested.map(nested => nested.id) : [row.id];
  const shown: Placed[] = [
    {
      ...base({ entry: row, parent: null, depth: 0 }),
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
    shown.push(...placeMembers({ of: header.row, memberOf: header.stack, parent: row, depth: 1, rail: true }));
  } else {
    for (const nested of stacks) {
      const memberIds = nested.row.nested.map(member => member.id);
      shown.push(
        {
          ...base({ entry: nested.row, parent: row, depth: 1 }),
          stack: nested.stack,
          nested: nested.row.nested,
          ids: memberIds,
          walked: memberIds,
          openId: nested.stack.open,
        },
        ...placeMembers({ of: nested.row, memberOf: nested.stack, parent: nested.row, depth: 2, rail: true }),
      );
    }
  }

  if (stack) {
    shown.push(...placeMembers({ of: row, memberOf: stack, parent: row, depth: 1, rail: false }));
  } else {
    shown.push(...row.nested.map(nested => base({ entry: nested, parent: row, depth: 1 })));
  }

  return shown;

  /** An entry as it is placed unless it is more. */
  function base({ entry, parent, depth }: BaseParams): Placed {
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

  /** A stack's pull requests under what expands it, while it is expanded. */
  function placeMembers({ of, memberOf, parent, depth, rail }: PlaceMembersParams): Placed[] {
    if (!isExpanded(memberOf)) {
      return [];
    }

    return of.nested.map(member => ({ ...base({ entry: member, parent, depth }), memberOf, rail }));
  }
}

/** What a row or a card is drawn from. */
function getSlotProps({ current, row, group }: GetSlotPropsParams): ListSlotProps<T> {
  const key = current.entry.key;
  return {
    entry: current.entry,
    parent: current.parent,
    group,
    selected: selectedCard.value?.entry.key === key,
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

/** On a stack's card, one of its pull requests clicked: the selection on it, and it opened. */
function openMember(key: string, id: string) {
  selectedKey.value = order.value.find(other => isNestedRowOf(other, key, id)) ?? key;
  selectedId.value = id;
  emit('open', id);
}

/** The pull request of a stack's card the selection is on. */
function getSelectedMember(current: Placed) {
  const selected = selectedKey.value === null ? undefined : placed.value.get(selectedKey.value);
  return selected?.memberOf && selected.parent?.key === current.entry.key ? selected.entry.id : null;
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
 * Selects the entry and its item: on a stack's entry or header the selected item when it is one of its, else the one
 * Enter opens.
 */
function select(key: string | null) {
  const current = key === null ? undefined : placed.value.get(key);
  const kept = selectedId.value;
  const inside = kept !== null && !!current && getToggled(current) !== null && current.walked.includes(kept);
  const id = inside ? kept : (current?.openId ?? null);
  selectedKey.value = key;
  selectedId.value = id;
}

/**
 * The items the selected entry stands for — read from the entry, as the model given by the owner changes only once it
 * re-renders.
 */
function currentIds(): readonly string[] {
  if (selectedKey.value === null) {
    return selectedId.value === null ? [] : [selectedId.value];
  }

  return selectedCard.value?.ids ?? [];
}

/** The item Enter opens for the selected entry. */
function currentOpenId() {
  const key = selectedKey.value;
  return key === null ? selectedId.value : (placed.value.get(key)?.openId ?? null);
}

/** `o`; whether the selected entry has a page there. */
function openSelectedOnGitHub() {
  const key = selectedKey.value;
  const current = key === null ? undefined : placed.value.get(key);
  const url = current ? props.getUrl(current.entry.value) : null;
  if (url) {
    browser.openInNewTab(url);
  }

  return !!url;
}

function scrollToSelected() {
  const key = selectedCard.value?.entry.key;
  const entry = key === undefined ? null : bodyRef.value?.querySelector(`[data-entry-key="${CSS.escape(key)}"]`);
  // On the board, the pull request the selection is on inside its card.
  const element = entry?.querySelector('[aria-current="true"]') ?? entry;
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
    go(drag.key);
    emit('move', { ids: drag.moved.map(entry => entry.id), from: drag.from, to: group.key });
  }
}

function endDrag() {
  dragged.value = null;
  dropTarget.value = null;
}

/**
 * A right-click: on an entry, the menu is for the items edited together when it is one of them, else for it alone,
 * which is selected, and an item open follows. Anywhere else the menu does not open (it never sees the event) and the browser's shows.
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
    menuMerge.value = null;
    return;
  }

  menuIds.value = current.ids;
  menuOpenId.value = current.openId;
  menuMerge.value = getMenuMerge(current);
  go(key);
}

/** "Merge all 3" on a stack's entry: its whole stack, as `⇧M` on it (D11). */
function getMenuMerge(current: Placed): Command | null {
  const target = current.stack && merging ? getStackTarget(current) : null;
  if (!target) {
    return null;
  }

  return {
    id: 'menu.merge',
    title: getMergeTitle(target),
    section: 'selection',
    key: EDIT_KEYS.merge,
    icon: GitMerge,
    run: () => mergeFromList(target),
  };
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

/** What is drawn for the entry: itself, or on the board the card a stack's pull request is inside. */
function getCard(key: string) {
  const current = placed.value.get(key);
  return props.layout === 'board' && current?.memberOf && current.parent
    ? placed.value.get(current.parent.key)
    : current;
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
      data-screen-keys-root
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
              v-if="group.rows.length === 0 && !group.quietWhenEmpty"
              :class="css.listView_note"
            >
              {{ t(l.groupEmpty) }}
            </p>
            <ul
              v-else-if="group.rows.length > 0 && !collapsed.has(group.key)"
              :class="css.listView_rows"
              data-screen-keys
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
                    v-bind="getSlotProps({ current, row, group })"
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
          <!-- Focusable, as a tall column scrolls on its own: its scroll must be reachable from the keyboard. -->
          <ul
            v-else
            :class="css.listView_cards"
            tabindex="0"
            data-screen-keys
          >
            <template
              v-for="row in group.rows"
              :key="row.key"
            >
              <li
                v-for="current in shownByRow.get(row.key)?.filter(shown => !shown.memberOf)"
                :key="current.entry.key"
                :class="[
                  css.listView_card,
                  current.parent && css.listView_card_nested,
                  selectedCard?.entry.key === current.entry.key && css.listView_card_selected,
                  isChecked(current.entry.key) && css.listView_card_checked,
                  dragged?.key === current.entry.key && css.listView_card_dragged,
                ]"
                :aria-current="selectedCard?.entry.key === current.entry.key ? 'true' : undefined"
                :data-entry-key="current.entry.key"
                :draggable="!current.parent && isDraggable(row, group) ? 'true' : undefined"
                @click="openEntry(current.entry.key)"
                @dragstart="startDrag($event, row, group)"
                @dragend="endDrag"
              >
                <slot
                  name="card"
                  v-bind="getSlotProps({ current, row, group })"
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

      <slot
        v-if="layout === 'list' && (groups.length === 0 || groups.some(group => !collapsed.has(group.key)))"
        name="end"
      />
    </div>
    <template #content>
      <slot
        name="contextMenu"
        :ids="menuIds"
        :open="openFromMenu"
        :merge="menuMerge"
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

.listView_row_selected {
  @include row-selected;
}

.listView_row_checked,
.listView_row_checked:hover {
  background: rgba($color-accent, 0.1);
}

.listView_row.listView_row_unmatched {
  @include dimmed-content;
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
