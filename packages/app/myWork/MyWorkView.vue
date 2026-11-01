<!-- "My work" (D1, D11): the toolbar with the filters, then the groups with their rows — all four, or the one group the sidebar narrowed it to — as a list, or as a board with a column per group (D9). The list engine (`ListView`) keeps the selection and the keys: `j`/`k` or ↓/↑ move it, Enter or a click opens it (an opened item follows the selection), `o` opens it on GitHub, `x` and `⇧↓`/`⇧↑` add rows to the items edited together and Escape empties them; while it holds any, the toolbar shows the `selection` slot — their actions. `1`–`3` switch filters. My work is grouped by reason (D11) or by repository (D22: the tracked ones in the sidebar's order, their rows named by number alone, then "Other repositories", not tracked — with the reasons still arriving after them); the order and the properties shown are the user's (`options`). A stack is one entry, whole, in the first reason any of its pull requests has (D3) — in the list a row (`StackRow`, its pull requests nested under it once expanded), on the board a card (`StackCard`, listing them inside it once expanded) — and a column counts it once, as the sidebar does. On the board a pull request nested under the issue it closes is a smaller card under the issue's, in the same column; the columns are the groups, and nothing is moved between them — neither a reason nor a repository is a value to set. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CloudOff, ListFilter } from 'lucide-vue-next';
import { computed } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import ItemCard from '@/lists/ItemCard.vue';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import { ITEM_PROPERTIES } from '@/lists/ItemProperty.js';
import ItemRow from '@/lists/ItemRow.vue';
import type { ItemSort } from '@/lists/ItemSort.js';
import ListToolbar from '@/lists/ListToolbar.vue';
import type { ListChoice, ListContextMenuProps, ListGroup, ListRow, ListViewOptions } from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import StackCard from '@/lists/StackCard.vue';
import StackRow from '@/lists/StackRow.vue';
import { useItemListChoices } from '@/lists/useItemListChoices.js';
import { isReviewRequestedOf } from '@/store/isReviewRequestedOf.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import { describeStack } from '@/store/stacks/describeStack.js';

import type { MyWork, MyWorkFilter, MyWorkRow } from './buildMyWork.js';
import { MY_WORK_FILTERS } from './buildMyWork.js';
import { groupMyWorkByRepository } from './groupMyWorkByRepository.js';
import MyWorkEmpty from './MyWorkEmpty.vue';
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
    /** The tracked repositories (`owner/name`) in the sidebar's order: the groups by repository, and the empty "my work" (K4). */
    trackedRepositories?: readonly string[];
    /** The item opened over the list (panel or modal): moving the selection opens the next one in its place. */
    openedId?: string | null;
    /** What was just undone of an item's edits, by its id ("“regression” label undone"). */
    undone?: ReadonlyMap<string, string>;
    /** The view options differ from the defaults: the display options offer a reset. */
    modified?: boolean;
  }>(),
  {
    group: null,
    getItem: () => undefined,
    openedId: null,
    undone: () => new Map(),
    modified: false,
    trackedRepositories: () => [],
  },
);

const emit = defineEmits<{
  /** Enter or a click on a row, or the selection moved while an item is open. */
  open: [id: string];
  /** The items the list shows, top to bottom — what an opened item steps through. */
  listed: [ids: readonly string[]];
  /** The view options back to their defaults. */
  reset: [];
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
  selection?(props: { ids: readonly string[] }): unknown;
  /** The entries of a row's context menu (`ListView`'s `contextMenu`). */
  contextMenu?(props: ListContextMenuProps): unknown;
}>();

const t = useTranslate();
const choices = useItemListChoices();

/** The key of the group of repositories the user doesn't track; no repository's `owner/name` can take it. */
const OTHER_REPOSITORIES = 'otherRepositories';
const FILTER_KEYS: Readonly<Record<MyWorkFilter, string>> = { all: '1', needsMe: '2', waitingOnOthers: '3' };

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
/**
 * The groups drawn. By reason: the narrowed one even when empty; else, in the list, those still arriving (G7)
 * and those with rows — on the board every column, unless none has anything (the empty state says so instead).
 * By repository: those with rows, then the reasons still arriving.
 */
const groups = computed((): ListGroup<Item>[] => {
  if (options.value.grouping === 'repository') {
    return [...repositoryGroups(), ...reasonGroups.value.filter(entry => !entry.arrived)];
  }

  if (props.group) {
    return reasonGroups.value;
  }

  const shown = reasonGroups.value.filter(entry => !entry.arrived || entry.rows.length > 0);
  return options.value.layout === 'board' && shown.length > 0 ? reasonGroups.value : shown;
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

/** The repository a group of the list is of: its rows are named by number alone. */
function repositoryOf(group: ListGroup<Item>) {
  return options.value.grouping === 'repository' && group.key !== OTHER_REPOSITORIES ? group.key : null;
}

/** A row as the engine lists it: a stack's entry or a plain row. */
function toListRow(row: MyWorkRow): ListRow<Item> {
  if (!row.stack) {
    return toListItem(row.item, row.nested);
  }

  const id = `stack:${row.stack.id}`;
  return {
    ...toListItem(row.item, row.nested),
    key: id,
    id,
    stack: {
      id: row.stack.id,
      description: describeStack({ stack: row.stack, viewerLogin: props.viewerLogin, getItem: props.getItem }),
      open: row.item.id,
      pullRequests: row.nested,
    },
  };
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
      :get-url="item => item.url"
      @open="emit('open', $event)"
      @listed="emit('listed', $event)"
    >
      <template #row="{ entry, parent, group: listGroup, checked, stack }">
        <StackRow
          v-if="stack"
          :stack="stack"
          :properties="properties"
          :repository="repositoryOf(listGroup)"
          people="author"
          :viewer-login="viewerLogin"
          :now="now"
          :checked="checked"
        />
        <ItemRow
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
        />
      </template>
      <template
        #card="{ entry, parent, group: listGroup, checked, stack, expanded, selectedMember, toggleStack, openMember }"
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
        />
      </template>
      <template #empty>
        <MyWorkEmpty
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
