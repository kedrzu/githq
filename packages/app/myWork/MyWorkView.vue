<!-- "My work" (D1, D11): the toolbar with the filters, then the groups with their rows — all four, or the one group the sidebar narrowed it to — as a list, or as a board with a column per group (D9). The list engine (`ListView`) keeps the selection and the keys: `j`/`k` or ↓/↑ move it, Enter or a click opens it (an opened item follows the selection), `o` opens it on GitHub, `x` and `⇧↓`/`⇧↑` add rows to the items edited together and Escape empties them; while it holds any, the toolbar shows the `selection` slot — their actions. `1`–`3` switch filters. My work is grouped by reason alone (D11); the order and the properties shown are the user's (`options`). On the board a pull request nested under the issue it closes is a smaller card under the issue's, in the same column; the columns are the four groups, and nothing is moved between them — a reason is not a value to set. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ListFilter } from 'lucide-vue-next';
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
import type { ListChoice, ListGroup, ListViewOptions } from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import { useItemListChoices } from '@/lists/useItemListChoices.js';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import type { Item } from '@/store/ItemTypes.js';

import type { MyWork, MyWorkFilter } from './buildMyWork.js';
import { MY_WORK_FILTERS } from './buildMyWork.js';
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
    /** Epoch ms the rows' ages are counted to. */
    now: number;
    /** How many of the user's pull requests wait on others, for the empty "Needs me". */
    waitingCount: number;
    /** How many repositories the user tracks, for the empty "my work" (K4). */
    trackedCount?: number;
    /** The item opened over the list (panel or modal): moving the selection opens the next one in its place. */
    openedId?: string | null;
    /** What was just undone of an item's edits, by its id ("“regression” label undone"). */
    undone?: ReadonlyMap<string, string>;
    /** The view options differ from the defaults: the display options offer a reset. */
    modified?: boolean;
  }>(),
  { group: null, openedId: null, undone: () => new Map(), modified: false, trackedCount: 0 },
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
}>();

const t = useTranslate();
const choices = useItemListChoices();

const FILTER_KEYS: Readonly<Record<MyWorkFilter, string>> = { all: '1', needsMe: '2', waitingOnOthers: '3' };

const filterOptions = computed((): SegmentedTabsOption<MyWorkFilter>[] =>
  MY_WORK_FILTERS.map(candidate => ({
    value: candidate,
    label: t(l[candidate]),
    keyshortcuts: FILTER_KEYS[candidate],
  })),
);
const groupings = computed((): ListChoice[] => [{ value: 'reason', label: t(l.reason) }]);
const title = computed(() => (props.group ? t(groupLabels[props.group]) : t(l.title)));
const properties = computed(() => {
  const shown = options.value.properties;
  return ITEM_PROPERTIES.filter((property): property is ItemProperty => shown.includes(property));
});

/** Every group as the engine lists it, a pull request under the issue it closes. */
const allGroups = computed((): ListGroup<Item>[] =>
  props.work.groups.map(entry => ({
    key: entry.group,
    label: t(groupLabels[entry.group]),
    arrived: entry.arrived,
    droppable: false,
    rows: entry.rows.map(row => ({
      key: row.item.id,
      id: row.item.id,
      value: row.item,
      nested: row.nested.map(nested => ({ key: nested.id, id: nested.id, value: nested })),
    })),
  })),
);
/**
 * The groups drawn: the narrowed one even when empty; else, in the list, those still arriving (G7) and those
 * with rows — on the board every column, unless none has anything (the empty state says so instead).
 */
const groups = computed(() => {
  const { group } = props;
  if (group) {
    return allGroups.value.filter(entry => entry.key === group);
  }

  const shown = allGroups.value.filter(entry => !entry.arrived || entry.rows.length > 0);
  return options.value.layout === 'board' && shown.length > 0 ? allGroups.value : shown;
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
      <template #row="{ entry, parent, group: listGroup, checked }">
        <ItemRow
          :item="entry.value"
          :parent="parent?.value"
          :properties="properties"
          :review-requested="listGroup.key === 'reviewRequested'"
          :viewer-login="viewerLogin"
          :now="now"
          :checked="checked"
          :undone="undone.get(entry.id)"
        />
      </template>
      <template #card="{ entry, parent, group: listGroup, checked }">
        <ItemCard
          :item="entry.value"
          :parent="parent?.value"
          :properties="properties"
          :review-requested="listGroup.key === 'reviewRequested'"
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
          :tracked-count="trackedCount"
          @show-waiting="filter = 'waitingOnOthers'"
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
  min-height: 0;
}

.myWorkView_filters {
  padding-left: $spacing-8;
}
</style>
