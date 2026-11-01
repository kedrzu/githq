<!-- The screen of a repository or project not tracked (J3, J4): what concerns the user, the only part of it githq has, then three quiet lines saying so and pointing to Settings, the only place tracking starts (D15). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, EyeOff } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import Button from '@/components/Button.vue';
import ItemCard from '@/lists/ItemCard.vue';
import type { ItemProperty } from '@/lists/ItemProperty.js';
import ItemRow from '@/lists/ItemRow.vue';
import type { ListContextMenuProps, ListGroup, ListRow } from '@/lists/ListTypes.js';
import ListView from '@/lists/ListView.vue';
import type { Item } from '@/store/ItemTypes.js';

import * as l from './UntrackedView.loc.js';

const props = withDefaults(
  defineProps<{
    icon: LucideIcon;
    /** A repository's `owner/name`, a project's title. */
    name: string;
    /** Dim text after the name. */
    meta?: string;
    githubUrl: string;
    /** What concerns the user, as listed. */
    rows: readonly ListRow<Item>[];
    /** The first line: what githq has of it. */
    summary: string;
    /** The second line: where the rest is. */
    others: string;
    /** The Settings section with the name searched. */
    settingsTo: string;
    properties: readonly ItemProperty[];
    /** The signed-in user. */
    viewerLogin: string;
    /** Epoch ms the rows' ages are counted to. */
    now: number;
    /** The item opened over the list (panel or modal). */
    openedId?: string | null;
    /** What was just undone of an item's edits, by its id. */
    undone?: ReadonlyMap<string, string>;
  }>(),
  {
    meta: '',
    openedId: null,
    undone: () => new Map(),
  },
);

const emit = defineEmits<{
  open: [id: string];
  listed: [ids: readonly string[]];
}>();

/** The selected item's id. */
const selectedId = defineModel<string | null>('selectedId', { default: null });
/** The items edited together (`x`). */
const checkedIds = defineModel<readonly string[]>('checkedIds', { default: () => [] });

defineSlots<{
  /** Beside the title: what narrows the list. */
  controls?(): unknown;
  /** The entries of a row's context menu (`ListView`'s `contextMenu`). */
  contextMenu?(props: ListContextMenuProps): unknown;
}>();

const t = useTranslate();

const groups = computed((): ListGroup<Item>[] =>
  props.rows.length > 0
    ? [{ key: 'concerns', label: t(l.concernsYou), arrived: true, droppable: false, rows: props.rows }]
    : [],
);
</script>

<template>
  <div :class="css.untrackedView">
    <header
      :class="css.untrackedView_header"
      v-bind="WINDOW_DRAG_REGION"
    >
      <component
        :is="icon"
        :class="css.untrackedView_headerIcon"
        aria-hidden="true"
      />
      <h1 :class="css.untrackedView_title">{{ name }}</h1>
      <span
        v-if="meta"
        :class="css.untrackedView_meta"
        >{{ meta }}</span
      >
      <span :class="css.untrackedView_badge">
        <EyeOff
          :class="css.untrackedView_badgeIcon"
          aria-hidden="true"
        />
        {{ t(l.notTracked) }}
      </span>
      <slot name="controls" />
      <span :class="css.untrackedView_spacer" />
      <Button
        variant="ghost"
        size="sm"
        :icon="ArrowUpRight"
        :link="githubUrl"
        target="_blank"
      >
        {{ t(l.openOnGitHub) }}
      </Button>
    </header>

    <div :class="css.untrackedView_body">
      <ListView
        v-model:selected-id="selectedId"
        v-model:checked-ids="checkedIds"
        :groups="groups"
        layout="list"
        :opened-id="openedId"
        :get-url="item => item.url"
        @open="emit('open', $event)"
        @listed="emit('listed', $event)"
      >
        <template #row="{ entry, checked }">
          <ItemRow
            :item="entry.value"
            :properties="properties"
            :viewer-login="viewerLogin"
            :now="now"
            :checked="checked"
            :undone="undone.get(entry.id)"
          />
        </template>
        <template #card="{ entry, checked }">
          <ItemCard
            :item="entry.value"
            :properties="properties"
            :viewer-login="viewerLogin"
            :now="now"
            :checked="checked"
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

      <section
        :class="css.untrackedView_rest"
        :aria-label="t(l.notTracking, { name })"
      >
        <p :class="css.untrackedView_summary">{{ summary }}</p>
        <p>{{ others }}</p>
        <p :class="css.untrackedView_pointer">
          {{ t(l.youCanTrackIt) }}
          <Button
            variant="link"
            :link="settingsTo"
          >
            {{ t(l.settings) }}
          </Button>
        </p>
      </section>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.untrackedView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.untrackedView_header {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: $list-header-height;
  padding: 0 $spacing-16;
  border-bottom: 1px solid $color-border;
}

.untrackedView_headerIcon {
  flex: none;
  width: 15px;
  height: 15px;
  color: $color-fg-2;
}

.untrackedView_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

.untrackedView_meta {
  font-size: $font-size-sm;
  color: $color-fg-dim;
  white-space: nowrap;
}

.untrackedView_badge {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 1px 8px;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
  border: 1px solid $color-border-2;
  border-radius: 10px;
}

.untrackedView_badgeIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.untrackedView_spacer {
  flex: 1;
}

// The few rows that concern the user, then the lines under them, scrolled together.
.untrackedView_body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.untrackedView_rest {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  padding: 20px 20px $spacing-24;
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.untrackedView_summary {
  color: $color-fg-2;
}

// Over the `link` button's own colour: the one way on from here, as J3 draws it.
.untrackedView_pointer a {
  color: $color-accent;
}
</style>
