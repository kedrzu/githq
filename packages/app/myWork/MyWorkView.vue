<!-- "My work" (D1, D11): the toolbar with the filters, then the groups with their rows — all four, or the one group the sidebar narrowed it to — as a list, or as a board with a column per group (D9). The list engine (`ListView`) keeps the selection and the keys: `j`/`k` or ↓/↑ move it, Enter or a click opens it (an opened item follows the selection), `o` opens it on GitHub, `x` and `⇧↓`/`⇧↑` add rows to the items edited together and Escape empties them; while it holds any, the toolbar shows the `selection` slot — their actions. `1`–`3` switch filters. My work is grouped by reason (D11), by repository (D22: the tracked ones in the sidebar's order, their rows named by number alone, then "Other repositories", not tracked), by status ("Needs me" exactly what that filter keeps, "Waiting on others" what its filter keeps and "Needs me" doesn't, with "Ready to merge", "Draft" and "Other" between and after) or by author (by login, "No author" last) — all but by reason with the reasons still arriving after them, and rows moved whole, a pull request or stack nested under its issue staying there; the order and the properties shown are the user's (`options`). A stack is one entry, whole, in the first reason any of its pull requests has (D3) — in the list a row (`StackRow`, its pull requests nested under it once expanded), on the board a card (`StackCard`, listing them inside it once expanded) — and a column counts it once, as the sidebar does. The last open pull request of a stack is a plain row or card, marked as part of the stack (D16, SP13). A stack of the user's closing an assigned issue sits under it instead, whole (stacked PRs D12): in the list the issue serves as its header — the stack's chevron, pips and state on the issue's row, its pull requests the issue's rows while expanded, Enter opening the issue and, with an item open, `j` walking on into the stack (D23) — and two stacks under one issue each get a header one step in, their rows on a rail below it (SP22). On the board a pull request nested under the issue it closes is a smaller card under the issue's, in the same column, and so is a stack's card closing it; the columns are the groups, and nothing is moved between them — neither a reason, a repository, a status nor an author is a value to set. On the first download, until a search has answered, the list is a full screen of ghosts (G16); then each group still arriving keeps its header with "…" over three ghost rows, or ghost cards in its column (G17): its empty state shows only once every group is in (first run and loading D8). With nothing on screen and a group that can't arrive now — offline, paused, GitHub failing — the can't-be-read note stands instead of ghosts that would spin forever (ES13, D6); with rows on screen the status bar alone tells it. Narrowed to one group that is in and empty, the note says what is shown and offers the rest (`MyWorkGroupEmpty`, D15, ES12). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  AtSign,
  CircleAlert,
  CircleCheck,
  CloudOff,
  GitPullRequestDraft,
  Hourglass,
  ListFilter,
} from 'lucide-vue-next';
import { computed } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import CantBeRead from '@/components/CantBeRead.vue';
import type { CantBeReadCause } from '@/components/CantBeReadCause.js';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import type { SelectionSpan } from '@/lists/getSelectionSpan.js';
import { getSelectionSpan } from '@/lists/getSelectionSpan.js';
import { getAssigneeGroupValue, NO_VALUE } from '@/lists/groupEntries.js';
import ItemCard from '@/lists/ItemCard.vue';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import { ITEM_PROPERTIES } from '@/lists/ItemProperty.js';
import ItemRow from '@/lists/ItemRow.vue';
import type { ItemSort } from '@/lists/ItemSort.js';
import ListToolbar from '@/lists/ListToolbar.vue';
import type {
  ListChoice,
  ListContextMenuProps,
  ListedItems,
  ListGroup,
  ListRow,
  ListViewOptions,
} from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import StackCard from '@/lists/StackCard.vue';
import StackRow from '@/lists/StackRow.vue';
import { useItemListChoices } from '@/lists/useItemListChoices.js';
import { isReviewRequestedOf } from '@/store/isReviewRequestedOf.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';
import type { PullRequestStack } from '@/store/stacks/groupStacks.js';

import type { MyWork, MyWorkCounts, MyWorkFilter, MyWorkRow, MyWorkStatus } from './buildMyWork.js';
import { MY_WORK_FILTERS } from './buildMyWork.js';
import { groupMyWorkByRepository } from './groupMyWorkByRepository.js';
import { groupMyWorkByAuthor, groupMyWorkByStatus } from './groupMyWorkRows.js';
import MyWorkEmpty from './MyWorkEmpty.vue';
import MyWorkGroupEmpty from './MyWorkGroupEmpty.vue';
import * as groupLabels from './MyWorkGroupLabel.loc.js';
import * as l from './MyWorkView.loc.js';
import { MY_WORK_VIEW_DEFAULTS } from './myWorkViewOptions.js';
import type { MyWorkGrouping } from './myWorkViewOptions.js';

const props = withDefaults(
  defineProps<{
    /** "My work" under the current filter, in the chosen order. */
    work: MyWork;
    /** The one group the list is narrowed to, or `null` for all four. */
    group?: MyWorkGroup | null;
    /** The signed-in user. */
    viewerLogin: string;
    /** An item of the local copy by id: the issue a stack's entry may be named after. */
    getItem?: (id: string) => Item | undefined;
    /** Epoch ms the rows' ages are counted to. */
    now: number;
    /** How many of the user's pull requests wait on others, for the empty "Needs me". */
    waitingCount: number;
    /** What "my work" holds under no filter, when `work` is under one: what the empty group's note counts. */
    unfilteredCounts?: MyWorkCounts | null;
    /** Why what hasn't arrived can't arrive now, as the sync tells it; `null` when nothing stands in its way. */
    cantBeRead?: CantBeReadCause | null;
    /** The tracked repositories (`owner/name`) in the sidebar's order: the groups by repository, and the empty "my work" (K4). */
    trackedRepositories?: readonly string[];
    /** The item opened over the list (panel or modal): moving the selection opens the next one in its place. */
    openedId?: string | null;
    /** The user has an edit of the item on its way (`ListView`). */
    isEdited?: (id: string) => boolean;
    /** What was just undone of an item's edits, by its id ("“regression” label undone"). */
    undone?: ReadonlyMap<string, string>;
    /** The view options differ from the defaults: the display options offer a reset. */
    modified?: boolean;
  }>(),
  {
    group: null,
    unfilteredCounts: null,
    cantBeRead: null,
    getItem: () => undefined,
    openedId: null,
    isEdited: () => false,
    undone: () => new Map(),
    modified: false,
    trackedRepositories: () => [],
  },
);

const emit = defineEmits<{
  /** Enter or a click on a row, or the selection moved while an item is open. */
  open: [id: string];
  /** The items the list shows, top to bottom — what an opened item steps through. */
  listed: [listed: ListedItems];
  /** The view options back to their defaults. */
  reset: [];
  /** "Show all of My work" from a narrowed group's note: all four groups, with `filter` cleared. */
  showAll: [];
}>();

const filter = defineModel<MyWorkFilter>('filter', { required: true });
/** The selected item's id. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`), in the list's order. */
const checkedIds = defineModel<readonly string[]>('checkedIds', { default: () => [] });
/** Layout, order and the properties rows show; kept on this device by the page. */
const options = defineModel<ListViewOptions<MyWorkGrouping, ItemSort>>('options', {
  default: () => MY_WORK_VIEW_DEFAULTS,
});

defineSlots<{
  /** The actions of the items edited together, while there are any. */
  selection?(props: { ids: readonly string[]; span: SelectionSpan }): unknown;
  /** The entries of a row's context menu (`ListView`'s `contextMenu`). */
  contextMenu?(props: ListContextMenuProps): unknown;
}>();

const t = useTranslate();
const choices = useItemListChoices();

/** The key of the group of repositories the user doesn't track; no repository's `owner/name` can take it. */
const OTHER_REPOSITORIES = 'otherRepositories';
const FILTER_KEYS: Readonly<Record<MyWorkFilter, string>> = { all: '1', needsMe: '2', waitingOnOthers: '3' };
const STATUS_ICONS: Readonly<Record<MyWorkStatus, LucideIcon>> = {
  needsMe: CircleAlert,
  readyToMerge: CircleCheck,
  waitingOnOthers: Hourglass,
  draft: GitPullRequestDraft,
  other: AtSign,
};

const filterOptions = computed((): SegmentedTabsOption<MyWorkFilter>[] =>
  MY_WORK_FILTERS.map(candidate => ({
    value: candidate,
    label: t(l[candidate]),
    keyshortcuts: FILTER_KEYS[candidate],
  })),
);
const groupings = computed((): ListChoice[] => [
  { value: 'reason', label: t(l.reason) },
  { value: 'repository', label: t(l.repository) },
  { value: 'status', label: t(l.status) },
  { value: 'author', label: t(l.author) },
]);
const title = computed(() => (props.group ? t(groupLabels[props.group]) : t(l.title)));
const properties = computed(() => {
  const shown = options.value.properties;
  return ITEM_PROPERTIES.filter((property): property is ItemProperty => shown.includes(property));
});

/**
 * The rows there because the user's review is asked: they say so whatever group they are drawn in. A stack's entry says
 * it itself ("Your review on 2 of 4"); its pull requests asking it say so as rows once it is expanded.
 */
const reviewRequestedIds = computed(
  () =>
    new Set(
      props.work.groups.flatMap(entry =>
        entry.group === 'reviewRequested'
          ? entry.rows.flatMap(row =>
              row.stack
                ? row.nested.filter(pr => isReviewRequestedOf(pr, props.viewerLogin)).map(pr => pr.id)
                : [row.item.id],
            )
          : [],
      ),
    ),
);
/** The reason groups shown: the narrowed one alone, or all four. */
const reasons = computed(() => props.work.groups.filter(entry => !props.group || entry.group === props.group));
/** The reason groups as the engine lists them. */
const reasonGroups = computed((): ListGroup<Item>[] =>
  reasons.value.map(entry => ({
    key: entry.group,
    label: t(groupLabels[entry.group]),
    arrived: entry.arrived,
    droppable: false,
    rows: entry.rows.map(toListRow),
  })),
);
/** Nothing on screen and something that can't arrive now: why, in place of the ghosts (D6's order). */
const unreadable = computed(() => {
  const nothingShown = reasons.value.every(entry => entry.rows.length === 0);
  return nothingShown && reasons.value.some(entry => !entry.arrived) ? props.cantBeRead : null;
});
/** The group the list is narrowed to has arrived, with nothing to show: its note stands for the list (D15). */
const narrowedEmpty = computed(
  () => props.group !== null && reasons.value.every(entry => entry.arrived && entry.rows.length === 0),
);
/**
 * The groups drawn: none while a note stands for them. By reason: the narrowed one; else, in the list, those still arriving (G17)
 * and those with rows — on the board every column, unless none has anything (the empty state says so instead).
 * By repository, status or author: those with rows, then the reasons still arriving.
 */
const groups = computed((): ListGroup<Item>[] => {
  if (unreadable.value || narrowedEmpty.value) {
    return [];
  }

  const grouping = options.value.grouping;
  switch (grouping) {
    case 'reason': {
      if (props.group) {
        return reasonGroups.value;
      }

      const shown = reasonGroups.value.filter(entry => !entry.arrived || entry.rows.length > 0);
      return options.value.layout === 'board' && shown.length > 0 ? reasonGroups.value : shown;
    }
    case 'repository':
      return [...repositoryGroups(), ...arriving()];
    case 'status':
      return [...statusGroups(), ...arriving()];
    case 'author':
      return [...authorGroups(), ...arriving()];
    default:
      return assertNever(grouping);
  }
});

// `1`–`3` switch the filters; the command menu offers them too.
useCommands(() =>
  MY_WORK_FILTERS.map(candidate => ({
    id: `myWork.filter.${candidate}`,
    title: t(l.showFilter, { filter: t(l[candidate]) }),
    section: 'view',
    key: FILTER_KEYS[candidate],
    icon: ListFilter,
    when: () => filter.value !== candidate,
    run: () => {
      filter.value = candidate;
    },
  })),
);

function showAll() {
  filter.value = 'all';
  emit('showAll');
}

function repositoryGroups(): ListGroup<Item>[] {
  return groupMyWorkByRepository(reasons.value, props.trackedRepositories).map(({ repository, rows }) => ({
    key: repository ?? OTHER_REPOSITORIES,
    label: repository ?? t(l.otherRepositories),
    monospace: repository !== null,
    detail: repository === null ? t(l.notTracked) : null,
    detailIcon: repository === null ? CloudOff : null,
    arrived: true,
    droppable: false,
    rows: rows.map(toListRow),
  }));
}

function statusGroups(): ListGroup<Item>[] {
  return groupMyWorkByStatus(reasons.value).map(({ key, rows }) => ({
    key,
    label: t(l[key]),
    marker: { kind: 'icon', icon: STATUS_ICONS[key] },
    arrived: true,
    droppable: false,
    rows: rows.map(toListRow),
  }));
}

function authorGroups(): ListGroup<Item>[] {
  return groupMyWorkByAuthor(reasons.value).map(({ author, rows }) => ({
    // Keyed apart from the reasons still arriving, whatever the login; a deleted account leaves no author.
    ...(author
      ? { ...getAssigneeGroupValue(author), key: `@${author.login}` }
      : { key: NO_VALUE, label: t(l.noAuthor) }),
    arrived: true,
    droppable: false,
    rows: rows.map(toListRow),
  }));
}

/** The reason groups still on their way (G17): drawn after the groups of what has arrived. */
function arriving() {
  return reasonGroups.value.filter(entry => !entry.arrived);
}

/** The repository a group of the list is of: its rows are named by number alone. */
function repositoryOf(group: ListGroup<Item>) {
  return options.value.grouping === 'repository' && group.key !== OTHER_REPOSITORIES ? group.key : null;
}

/** A row as the engine lists it: a stack's entry or a plain row, with the stacks nested under an issue (D12). */
function toListRow(row: MyWorkRow): ListRow<Item> {
  if (!row.stack) {
    return {
      ...toListItem(row.item, row.nested),
      stacks: (row.stacks ?? []).map(toListRow),
      stackMarker: row.stackMarker ? describe(row.stackMarker) : null,
    };
  }

  const id = `stack:${row.stack.id}`;
  return {
    ...toListItem(row.item, row.nested),
    key: id,
    id,
    stack: {
      id: row.stack.id,
      description: describe(row.stack),
      open: row.item.id,
      pullRequests: row.nested,
      unmatched: row.unmatched ?? null,
    },
  };
}

function describe(stack: PullRequestStack) {
  return describeStack({ stack, viewerLogin: props.viewerLogin, getItem: props.getItem });
}

function toListItem(item: Item, nested: readonly Item[]): ListRow<Item> {
  return {
    key: item.id,
    id: item.id,
    value: item,
    nested: nested.map(entry => ({ key: entry.id, id: entry.id, value: entry })),
  };
}
</script>

<template>
  <div :class="css.myWorkView">
    <ListToolbar
      v-model:options="options"
      :title="title"
      :groupings="groupings"
      :sorts="choices.sorts.value"
      :properties="choices.properties.value"
      :modified="modified"
      @reset="emit('reset')"
    >
      <slot
        v-if="checkedIds.length > 0"
        name="selection"
        :ids="checkedIds"
        :span="getSelectionSpan(groups, checkedIds)"
      />
      <SegmentedTabs
        v-model="filter"
        :class="css.myWorkView_filters"
        :label="t(l.filters)"
        :options="filterOptions"
      />
    </ListToolbar>

    <ListView
      v-model:selected-id="selectedId"
      v-model:checked-ids="checkedIds"
      :groups="groups"
      :layout="options.layout"
      :opened-id="openedId"
      :is-edited="isEdited"
      :get-url="item => item.url"
      @open="emit('open', $event)"
      @listed="emit('listed', $event)"
    >
      <template
        #row="{ entry, parent, group: listGroup, selected, checked, halfChecked, stack, stackMarker, header, depth }"
      >
        <StackRow
          v-if="stack"
          :stack="stack"
          :properties="properties"
          :repository="repositoryOf(listGroup)"
          :parent="parent?.value"
          people="author"
          :viewer-login="viewerLogin"
          :now="now"
          :selected="selected"
          :checked="checked"
          :half-checked="halfChecked"
          :opened-id="openedId"
        />
        <ItemRow
          v-else
          :item="entry.value"
          :parent="parent?.value"
          :deep="depth > 1"
          :header="header"
          :opened-id="openedId"
          :properties="properties"
          :repository="repositoryOf(listGroup)"
          :review-requested="reviewRequestedIds.has(entry.id)"
          :viewer-login="viewerLogin"
          :now="now"
          :checked="checked"
          :undone="undone.get(entry.id)"
          :stack="stackMarker"
        />
      </template>
      <template
        #card="{
          entry,
          parent,
          group: listGroup,
          checked,
          halfChecked,
          stack,
          stackMarker,
          expanded,
          selectedMember,
          toggleStack,
          openMember,
        }"
      >
        <StackCard
          v-if="stack"
          :stack="stack"
          :properties="properties"
          :repository="repositoryOf(listGroup)"
          people="author"
          :viewer-login="viewerLogin"
          :now="now"
          :checked="checked"
          :half-checked="halfChecked"
          :opened-id="openedId"
          :expanded="expanded"
          :selected-member="selectedMember"
          @toggle="toggleStack"
          @open="openMember"
        />
        <ItemCard
          v-else
          :item="entry.value"
          :parent="parent?.value"
          :properties="properties"
          :repository="repositoryOf(listGroup)"
          :review-requested="reviewRequestedIds.has(entry.id)"
          :viewer-login="viewerLogin"
          :now="now"
          :checked="checked"
          :undone="undone.get(entry.id)"
          :stack="stackMarker"
        />
      </template>
      <template #empty>
        <CantBeRead
          v-if="unreadable"
          place="screen"
          :cause="unreadable"
          :thing="t(l.yourWork)"
        />
        <MyWorkGroupEmpty
          v-else-if="group"
          :group="group"
          :filter="filter"
          :counts="unfilteredCounts ?? work.counts"
          :all-arrived="work.groups.every(entry => entry.arrived)"
          @clear-filter="filter = 'all'"
          @show-all="showAll"
        />
        <MyWorkEmpty
          v-else
          :filter="filter"
          :waiting-count="waitingCount"
          :waiting-key="FILTER_KEYS.waitingOnOthers"
          :tracked-count="trackedRepositories.length"
          @show-waiting="filter = 'waitingOnOthers'"
        />
      </template>
      <template
        v-if="$slots.contextMenu"
        #contextMenu="menu"
      >
        <slot
          name="contextMenu"
          v-bind="menu"
        />
      </template>
    </ListView>
  </div>
</template>

<style lang="scss" module="css">
.myWorkView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.myWorkView_filters {
  padding-left: $spacing-8;
}
</style>
