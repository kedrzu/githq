<!-- The pull requests with the viewer's draft review (code review D28, CR34): a head with the count, what a draft means for the others, then the list, the one waiting longest first, each saying how long. `J`/`K`, the selection and its actions are the list engine's (`ListView`); Enter opens the review, where the draft is. The sidebar's entry goes with the last draft, and if the list is what was open it says so. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleCheck, PencilLine } from 'lucide-vue-next';
import { computed } from 'vue';

import EmptyState from '@/components/EmptyState.vue';
import Kbd from '@/components/Kbd.vue';
import type { SelectionSpan } from '@/lists/getSelectionSpan.js';
import { getSelectionSpan } from '@/lists/getSelectionSpan.js';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import ItemRow from '@/lists/ItemRow.vue';
import type { ListContextMenuProps, ListGroup, ListedItems } from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';

import * as l from './DraftReviewsView.loc.js';

const PROPERTIES: readonly ItemProperty[] = ['status', 'people', 'size', 'updated'];

const props = defineProps<{
  /** In the order they show. */
  drafts: readonly PullRequestItem[];
  /** The signed-in user. */
  viewerLogin: string;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** What was just undone of an item's edits, by its id. */
  undone?: ReadonlyMap<string, string>;
}>();

const emit = defineEmits<{
  /** Enter or a click on a row. */
  open: [id: string];
  /** The items the list shows, top to bottom. */
  listed: [listed: ListedItems];
}>();

/** The selected item's id. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`), in the list's order. */
const checkedIds = defineModel<readonly string[]>('checkedIds', { default: () => [] });

defineSlots<{
  /** The actions of the items edited together, while there are any. */
  selection?(props: { ids: readonly string[]; span: SelectionSpan }): unknown;
  /** The entries of a row's context menu (`ListView`'s `contextMenu`). */
  contextMenu?(props: ListContextMenuProps): unknown;
}>();

const t = useTranslate();

const groups = computed((): ListGroup<Item>[] =>
  props.drafts.length === 0
    ? []
    : [
        {
          key: 'drafts',
          label: t(l.title),
          headless: true,
          arrived: true,
          droppable: false,
          rows: props.drafts.map(item => ({ key: item.id, id: item.id, value: item, nested: [] })),
        },
      ],
);
</script>

<template>
  <div :class="css.draftReviewsView">
    <header :class="css.draftReviewsView_head">
      <PencilLine
        :class="css.draftReviewsView_icon"
        aria-hidden="true"
      />
      <h1 :class="css.draftReviewsView_title">{{ t(l.title) }}</h1>
      <span :class="css.draftReviewsView_count">{{ drafts.length }}</span>
      <span :class="css.draftReviewsView_selection">
        <slot
          v-if="checkedIds.length > 0"
          name="selection"
          :ids="checkedIds"
          :span="getSelectionSpan(groups, checkedIds)"
        />
      </span>
    </header>
    <p
      v-if="drafts.length > 0"
      :class="css.draftReviewsView_explainer"
    >
      {{ t(l.explainer) }}
    </p>
    <ListView
      v-model:selected-id="selectedId"
      v-model:checked-ids="checkedIds"
      :groups="groups"
      layout="list"
      :get-url="item => item.url"
      @open="emit('open', $event)"
      @listed="emit('listed', $event)"
    >
      <template #row="{ entry, checked }">
        <ItemRow
          :item="entry.value"
          :properties="PROPERTIES"
          :viewer-login="viewerLogin"
          :now="now"
          :checked="checked"
          :undone="undone?.get(entry.value.id)"
          draft-age
        />
      </template>
      <template #groupFooter>
        <p :class="css.draftReviewsView_hint">
          <Kbd keys="Enter" />
          {{ t(l.openReview) }}
        </p>
      </template>
      <template #empty>
        <EmptyState
          :icon="CircleCheck"
          :title="t(l.empty)"
          :detail="t(l.emptyDetail)"
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
.draftReviewsView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.draftReviewsView_head {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  height: 48px;
  padding: 0 $spacing-16;
  border-bottom: 1px solid $color-border;
}

.draftReviewsView_icon {
  flex: none;
  width: 15px;
  height: 15px;
  color: $color-amber;
}

.draftReviewsView_title {
  margin: 0;
  font-size: 14px;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.draftReviewsView_count {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.draftReviewsView_selection {
  display: flex;
  flex: 1;
  gap: $spacing-8;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.draftReviewsView_explainer {
  flex: none;
  padding: $spacing-12 $spacing-16;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
  border-bottom: 1px solid $color-border;
}

.draftReviewsView_hint {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  padding: $spacing-12 $spacing-16;
  margin: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
