<!-- The toolbar of every list (D9, D4, J1, J2): the title (a button opening the menu of the repository or project it names, where there is one: R1, R2), then what the list puts beside it (tabs, the actions of the items selected together), and on the right its filters (a repository's state) and the view options, each a control with its own icon — the grouping ("Group: Milestone"), the order, the properties rows show, what the list adds (a project's row field) and the List / Board toggle (Board can be unavailable, K7). As many as fit stay on the toolbar, the filters longest; the rest move into the display options — each a section with its icon and its choices right there, no menu within the menu — which also say that the options are kept on this device only and can reset them. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowDownUp,
  ChevronDown,
  Columns3,
  LayoutGrid,
  List,
  ListChecks,
  RotateCcw,
  Rows3,
  SlidersHorizontal,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

import type { Command, CommandOption } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import Popover from '@/components/Popover.vue';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';

import * as l from './ListToolbar.loc.js';
import ListToolbarControl from './ListToolbarControl.vue';
import type { ListToolbarOption } from './ListToolbarControl.vue';
import type { ListChoice, ListViewOptions } from './ListTypes.js';

const props = withDefaults(
  defineProps<{
    title: string;
    /** What the list can be grouped by; the menu's headings come from their `section`. */
    groupings: readonly ListChoice[];
    /** The orders the list offers. */
    sorts: readonly ListChoice[];
    /** The properties rows may show. */
    properties: readonly ListChoice[];
    /** The list's own view options, after the list's common ones (a project's row field). */
    extraOptions?: readonly ListToolbarOption[];
    /** What narrows the list (a repository's state): before the view options, the last to leave the toolbar. */
    filters?: readonly ListToolbarOption[];
    /** The options differ from the list's defaults: the display options offer to reset them. */
    modified?: boolean;
    /** The board can't be chosen (a project with nothing to make columns of, K7); the display options say why. */
    boardDisabled?: boolean;
  }>(),
  { extraOptions: () => [], filters: () => [], modified: false, boardDisabled: false },
);

const emit = defineEmits<{
  /** Back to the list's defaults. */
  reset: [];
}>();

defineSlots<{
  /** The entries of the menu the title opens (a repository's or a project's); without it the title is plain text. */
  titleMenu?(): unknown;
  /** Beside the title: what it is, how many ("private · 142 open"). */
  title?(): unknown;
  /** After the title: tabs, the actions of a selection. */
  default?(): unknown;
  /** More in the display options, after the options that didn't fit the toolbar (why the board is unavailable). */
  display?(): unknown;
  /** At the top of the display options: what they are changed from (a project's saved view). */
  displayHeader?(): unknown;
}>();

const options = defineModel<ListViewOptions>('options', { required: true });

const t = useTranslate();

const sortChoice = computed(() => props.sorts.find(choice => choice.value === options.value.sort));
const grouping = computed(() => props.groupings.find(choice => choice.value === options.value.grouping));

/** Every option, the filters then the view options, in the toolbar's order. */
const viewOptions = computed((): ListToolbarOption[] => [
  ...props.filters,
  {
    kind: 'menu',
    key: 'grouping',
    label: t(l.group),
    icon: Rows3,
    title: t(l.groupBy, { grouping: grouping.value?.label ?? '' }),
    choices: props.groupings,
    value: options.value.grouping,
    choose: value => change({ grouping: value }),
  },
  ...(props.sorts.length > 1
    ? [
        {
          kind: 'menu',
          key: 'sort',
          label: t(l.order),
          icon: ArrowDownUp,
          title: t(l.orderBy, { order: sortChoice.value?.label ?? '' }),
          choices: props.sorts,
          value: options.value.sort,
          choose: value => change({ sort: value }),
        } satisfies ListToolbarOption,
      ]
    : []),
  {
    kind: 'chips',
    key: 'properties',
    label: t(l.properties),
    icon: ListChecks,
    choices: props.properties,
    value: options.value.properties,
    choose: value => change({ properties: value }),
  },
  ...props.extraOptions,
  {
    kind: 'tabs',
    key: 'layout',
    label: t(l.layout),
    icon: LayoutGrid,
    options: [
      { value: 'list', label: t(l.list), icon: List, iconOnly: true },
      { value: 'board', label: t(l.board), icon: Columns3, iconOnly: true, disabled: props.boardDisabled },
    ],
    value: options.value.layout,
    choose: value => change({ layout: value === 'board' ? 'board' : 'list' }),
  },
]);

/**
 * Which options stay on the toolbar when there isn't room for all: the filters, then the layout, the grouping,
 * the order, the properties and the list's own, in that order — the rest move into the display options.
 */
const PRIORITY = ['layout', 'grouping', 'sort', 'properties'];

/** The keys of the options that fit the toolbar; all of them until it has been measured. */
const fitting = ref<ReadonlySet<string> | null>(null);
const onToolbar = computed(() => viewOptions.value.filter(option => !fitting.value || fitting.value.has(option.key)));
const inDisplay = computed(() => viewOptions.value.filter(option => fitting.value && !fitting.value.has(option.key)));

const controls = useTemplateRef<HTMLElement>('controls');
const measure = useTemplateRef<HTMLElement>('measure');
let observer: ResizeObserver | undefined;
let frame = 0;

onMounted(() => {
  // A frame later: what `fit` moves resizes what is observed, which must not happen within the observer's turn.
  observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  });
  for (const element of [controls.value, measure.value]) {
    if (element) {
      observer.observe(element);
    }
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
});

/** Keeps on the toolbar as many options as its free space holds, by priority, each at its full width. */
function fit() {
  if (!controls.value || !measure.value) {
    return;
  }

  const gap = Number.parseFloat(getComputedStyle(measure.value).columnGap) || 0;
  const available = controls.value.clientWidth;
  const widths = new Map<string, number>();
  for (const element of measure.value.children) {
    if (element instanceof HTMLElement && element.dataset.key) {
      widths.set(element.dataset.key, element.getBoundingClientRect().width);
    }
  }

  const ranked = viewOptions.value.map(option => option.key).toSorted((a, b) => rank(a) - rank(b));
  const fits = new Set<string>();
  let used = 0;
  for (const key of ranked) {
    used += (widths.get(key) ?? 0) + (fits.size > 0 ? gap : 0);
    if (used > available) {
      break;
    }

    fits.add(key);
  }

  if (!fitting.value || fitting.value.size !== fits.size || [...fits].some(key => !fitting.value?.has(key))) {
    fitting.value = fits;
  }
}

function rank(key: string) {
  if (props.filters.some(filter => filter.key === key)) {
    return -1;
  }

  const index = PRIORITY.indexOf(key);
  return index === -1 ? PRIORITY.length : index;
}

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
  <header
    :class="css.listToolbar"
    v-bind="WINDOW_DRAG_REGION"
  >
    <h1 :class="css.listToolbar_title">
      <Menu
        v-if="$slots.titleMenu"
        align="start"
      >
        <template #trigger>
          <button
            type="button"
            :class="css.listToolbar_titleButton"
            :aria-label="t(l.titleMenuLabel, { title })"
          >
            {{ title }}
            <ChevronDown
              :class="css.listToolbar_titleChevron"
              aria-hidden="true"
            />
          </button>
        </template>
        <slot name="titleMenu" />
      </Menu>
      <template v-else>{{ title }}</template>
    </h1>
    <slot name="title" />
    <slot />
    <div
      ref="controls"
      :class="css.listToolbar_controls"
    >
      <ListToolbarControl
        v-for="option in onToolbar"
        :key="option.key"
        :option="option"
        place="toolbar"
      />
    </div>
    <!-- Every option as the toolbar would draw it, unseen: the widths `fit` compares with the room there is. -->
    <div
      :class="css.listToolbar_measure"
      aria-hidden="true"
      inert
    >
      <div
        ref="measure"
        :class="css.listToolbar_measureRow"
      >
        <ListToolbarControl
          v-for="option in viewOptions"
          :key="option.key"
          :data-key="option.key"
          :option="option"
          place="toolbar"
        />
      </div>
    </div>
    <Popover
      :label="t(l.display)"
      align="end"
      flush
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
        <ListToolbarControl
          v-for="option in inDisplay"
          :key="option.key"
          :option="option"
          place="display"
        />
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
  position: relative;
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

/* As the opened item's reference opens its menu (M1). */
.listToolbar_titleButton {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  height: 26px;
  padding: 0 $spacing-6;
  margin-left: -$spacing-6;
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-md;

  &:hover,
  &[data-state='open'] {
    background: $color-bg-3;
  }
}

.listToolbar_titleChevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}

/* Takes the room the rest leaves, whatever its options need: `fit` keeps in it only those that fit. */
.listToolbar_controls {
  display: flex;
  flex: 1 1 0;
  gap: $spacing-10;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.listToolbar_measure {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
}

.listToolbar_measureRow {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  width: max-content;
}

.listToolbar_display {
  display: flex;
  flex-direction: column;
  width: 340px;
}

/* Under the sections, each closed by its own border. */
.listToolbar_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: $spacing-6 $spacing-8 $spacing-6 14px;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
