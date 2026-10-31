<!-- The toolbar of every list (D9, D4, J1, J2): the title, then what the list puts beside it (filters, tabs, the actions of the items selected together), and on the right its own actions, the grouping menu ("Group: Milestone"), the List / Board toggle (Board can be unavailable, K7) and the display options — the order (a menu when there are many) and the properties rows show, and what the list adds (a project's row field) — which are kept on this device only and can be reset. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowDownUp, Columns3, List, RotateCcw, Rows3, SlidersHorizontal } from 'lucide-vue-next';
import { computed } from 'vue';

import type { Command, CommandOption } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuRadioGroup from '@/components/MenuRadioGroup.vue';
import MenuRadioItem from '@/components/MenuRadioItem.vue';
import Popover from '@/components/Popover.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import ToggleChips from '@/components/ToggleChips.vue';

import * as l from './ListToolbar.loc.js';
import type { ListChoice, ListLayout, ListViewOptions } from './ListTypes.js';

const props = withDefaults(
  defineProps<{
    title: string;
    /** What the list can be grouped by; the menu's headings come from their `section`. */
    groupings: readonly ListChoice[];
    /** The orders the display options offer. */
    sorts: readonly ListChoice[];
    /** The properties rows may show. */
    properties: readonly ListChoice[];
    /** The options differ from the list's defaults: the display options offer to reset them. */
    modified?: boolean;
    /** The board can't be chosen (a project with nothing to make columns of, K7); the display options say why. */
    boardDisabled?: boolean;
  }>(),
  { modified: false, boardDisabled: false },
);

const emit = defineEmits<{
  /** Back to the list's defaults. */
  reset: [];
}>();

defineSlots<{
  /** Beside the title: what it is, how many ("private · 142 open"). */
  title?(): unknown;
  /** After the title: filters, tabs, the actions of a selection. */
  default?(): unknown;
  /** On the right, before the grouping. */
  actions?(): unknown;
  /** More display options, after the order and the properties (a project's row field). */
  display?(): unknown;
  /** At the top of the display options: what they are changed from (a project's saved view). */
  displayHeader?(): unknown;
}>();

const options = defineModel<ListViewOptions>('options', { required: true });

const t = useTranslate();

const MAX_SORT_TABS = 4;

const layoutOptions = computed((): SegmentedTabsOption<ListLayout>[] => [
  { value: 'list', label: t(l.list), icon: List, iconOnly: true },
  { value: 'board', label: t(l.board), icon: Columns3, iconOnly: true, disabled: props.boardDisabled },
]);
/** Few orders sit side by side; many (a project's fields, both ways) are a menu. */
const sortAsMenu = computed(() => props.sorts.length > MAX_SORT_TABS);
const sortChoice = computed(() => props.sorts.find(choice => choice.value === options.value.sort));
const grouping = computed(() => props.groupings.find(choice => choice.value === options.value.grouping));
/** The grouping menu's choices under their headings, in order. */
const groupingSections = computed(() => {
  const sections: { label: string | undefined; choices: ListChoice[] }[] = [];
  for (const choice of props.groupings) {
    const last = sections.at(-1);
    if (last && last.label === choice.section) {
      last.choices.push(choice);
    } else {
      sections.push({ label: choice.section, choices: [choice] });
    }
  }

  return sections;
});
const sortOptions = computed((): SegmentedTabsOption<string>[] =>
  props.sorts.map(choice => ({ value: choice.value, label: choice.label })),
);

const layout = computed({
  get: () => options.value.layout,
  set: value => change({ layout: value }),
});
const groupingValue = computed({
  get: () => options.value.grouping,
  set: value => change({ grouping: value }),
});
const sort = computed({
  get: () => options.value.sort,
  set: value => change({ sort: value }),
});
const shown = computed({
  get: () => options.value.properties,
  set: value => change({ properties: value }),
});

// E1: the view's options in the command menu too — the layout by its key.
useCommands(
  () =>
    [
      {
        id: 'view.layout',
        title: options.value.layout === 'list' ? t(l.showAsBoard) : t(l.showAsList),
        section: 'view',
        key: 'Shift+V',
        icon: options.value.layout === 'list' ? Columns3 : List,
        when: () => options.value.layout === 'board' || !props.boardDisabled,
        run: () => change({ layout: options.value.layout === 'list' ? 'board' : 'list' }),
      },
      {
        id: 'view.groupBy',
        title: t(l.groupByCommand),
        section: 'view',
        detail: grouping.value?.label,
        icon: Rows3,
        options: () => ({ options: toCommandOptions(props.groupings, options.value.grouping, 'grouping') }),
      },
      {
        id: 'view.orderBy',
        title: t(l.orderByCommand),
        section: 'view',
        detail: sortChoice.value?.label,
        icon: ArrowDownUp,
        options: () => ({ options: toCommandOptions(props.sorts, options.value.sort, 'sort') }),
      },
    ] satisfies Command[],
);

/** The choices as a submenu's options: picking one sets it. */
function toCommandOptions(choices: readonly ListChoice[], current: string, option: 'grouping' | 'sort') {
  return choices.map((choice): CommandOption => ({
    value: choice.value,
    label: choice.label,
    detail: choice.detail,
    group: choice.section,
    chosen: choice.value === current,
    pick: () => change(option === 'grouping' ? { grouping: choice.value } : { sort: choice.value }),
  }));
}

function change(changes: Partial<ListViewOptions>) {
  options.value = { ...options.value, ...changes };
}
</script>

<template>
  <header :class="css.listToolbar">
    <h1 :class="css.listToolbar_title">{{ title }}</h1>
    <slot name="title" />
    <slot />
    <span :class="css.listToolbar_spacer" />
    <slot name="actions" />
    <Menu align="end">
      <template #trigger>
        <Button
          variant="outline"
          size="sm"
          :icon="Rows3"
        >
          {{ t(l.groupBy, { grouping: grouping?.label ?? '' }) }}
        </Button>
      </template>
      <MenuRadioGroup v-model="groupingValue">
        <template
          v-for="section in groupingSections"
          :key="section.label ?? ''"
        >
          <MenuLabel v-if="section.label">{{ section.label }}</MenuLabel>
          <MenuRadioItem
            v-for="choice in section.choices"
            :key="choice.value"
            :value="choice.value"
            :icon="choice.icon"
            :detail="choice.detail"
          >
            {{ choice.label }}
          </MenuRadioItem>
        </template>
      </MenuRadioGroup>
    </Menu>
    <SegmentedTabs
      v-model="layout"
      variant="boxed"
      :label="t(l.layout)"
      :options="layoutOptions"
    />
    <Popover
      :label="t(l.display)"
      align="end"
    >
      <template #trigger>
        <Button
          variant="ghost"
          size="sm"
          :icon="SlidersHorizontal"
        >
          {{ t(l.display) }}
        </Button>
      </template>
      <div :class="css.listToolbar_display">
        <slot name="displayHeader" />
        <div
          v-if="sorts.length > 1"
          :class="css.listToolbar_option"
        >
          <span :class="css.listToolbar_optionLabel">{{ t(l.order) }}</span>
          <Menu
            v-if="sortAsMenu"
            align="start"
          >
            <template #trigger>
              <Button
                variant="outline"
                size="sm"
                :icon="ArrowDownUp"
              >
                {{ t(l.orderBy, { order: sortChoice?.label ?? '' }) }}
              </Button>
            </template>
            <MenuRadioGroup v-model="sort">
              <MenuRadioItem
                v-for="choice in sorts"
                :key="choice.value"
                :value="choice.value"
              >
                {{ choice.label }}
              </MenuRadioItem>
            </MenuRadioGroup>
          </Menu>
          <SegmentedTabs
            v-else
            v-model="sort"
            :label="t(l.order)"
            :options="sortOptions"
          />
        </div>
        <div :class="css.listToolbar_option">
          <span :class="css.listToolbar_optionLabel">{{ t(l.properties) }}</span>
          <ToggleChips
            v-model="shown"
            :label="t(l.properties)"
            :options="properties"
          />
        </div>
        <slot name="display" />
        <div :class="css.listToolbar_footer">
          <span>{{ t(l.deviceOnly) }}</span>
          <Button
            v-if="modified"
            variant="ghost"
            size="sm"
            :icon="RotateCcw"
            @click="emit('reset')"
          >
            {{ t(l.reset) }}
          </Button>
        </div>
      </div>
    </Popover>
  </header>
</template>

<style lang="scss" module="css">
.listToolbar {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: $list-header-height;
  padding: 0 $spacing-16;
  border-bottom: 1px solid $color-border;
}

.listToolbar_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

.listToolbar_spacer {
  flex: 1;
}

.listToolbar_display {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  width: 300px;
  padding: $spacing-4;
}

.listToolbar_option {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.listToolbar_optionLabel {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.listToolbar_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  padding-top: $spacing-8;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  border-top: 1px solid $color-border;
}
</style>
