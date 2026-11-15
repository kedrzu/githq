<!-- The toolbar of every list (D9, D4, J1, J2): the title (a button opening the menu of the repository or project it names, where there is one: R1, R2), then what the list puts beside it (tabs, the actions of the items selected together), and on the right its filters (a repository's state) and the view options, each a control with its own icon — the grouping ("Group: Milestone"), the order, the properties rows show, what the list adds (a project's row field) and the List / Board toggle (Board can be unavailable, K7). As many as fit stay on the toolbar, the filters longest; the rest move into the display options — each a section with its icon and its choices right there, no menu within the menu — which also say that the options are kept on this device only and can reset them. The options are commands of the command menu too (E1): the layout by its key; the grouping and the order, the properties (several, each toggled with the menu staying open), the menu options that have a `commandTitle` (a repository's state, a project's row field) as submenus; and, while the options differ from the defaults, one to reset them. On a phone (mobile MB32) it is the phone's top bar (`PhoneTopBar`): the places button, the title, the options button opening the list's options as a sheet from below (`ListOptionsSheet`, mobile D36: the filters, the grouping and the order, changed in place, and the way back while changed) and New issue — what `C` runs there; the title's menu and what the list puts beside the title (tabs, a selection's actions) leave it, the properties and the list's own options staying in the command menu, and no layout offered anywhere, a phone having no board (mobile D9). A list whose items can be selected together (`selection`) offers "Select items" in that sheet; while selecting (mobile D28, MB117) the top bar is × leaving it, "3 selected" and the options, and the selection's actions draw nothing, their commands the command menu's. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowDownUp, Columns3, LayoutGrid, List, ListChecks, Plus, RotateCcw, Rows3, X } from 'lucide-vue-next';
import { computed, ref, useTemplateRef, watch } from 'vue';

import { CommandRegistry, NEW_ISSUE_KEY } from '@/commands/CommandRegistry.js';
import type { Command, CommandOption } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import IconButton from '@/components/IconButton.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import PhoneTopBar from '@/shell/PhoneTopBar.vue';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';

import ListDisplayOptions from './ListDisplayOptions.vue';
import ListOptionsSheet from './ListOptionsSheet.vue';
import ListTitle from './ListTitle.vue';
import * as l from './ListToolbar.loc.js';
import ListToolbarControl from './ListToolbarControl.vue';
import type { ListToolbarMenuOption, ListToolbarOption } from './ListToolbarControl.vue';
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
    /** No filters or view options, here or in the menu: what is shown is not a list of items (a repository's workflows). */
    bare?: boolean;
    /**
     * The list's own name where the title names its place (a project's saved view, a repository's section): it heads a
     * phone's options sheet, the title under it.
     */
    listName?: string;
    /** The saved view on github.com the list shows (a project's): a phone's options sheet links to it (`ListOptionsSheet`). */
    gitHubView?: string | null;
  }>(),
  {
    extraOptions: () => [],
    filters: () => [],
    modified: false,
    boardDisabled: false,
    bare: false,
    listName: undefined,
    gitHubView: null,
  },
);

const emit = defineEmits<{
  /** Back to the list's defaults. */
  reset: [];
  /** The saved view's filter cleared on this device, from a phone's options sheet. */
  clearFilter: [];
}>();

const slots = defineSlots<{
  /** The entries of the menu the title opens (a repository's or a project's); without it the title is plain text. */
  titleMenu?(): unknown;
  /** Beside the title: what it is, how many ("private · 142 open"). */
  title?(): unknown;
  /**
   * The actions of the items selected together, after the title — on a phone drawing nothing, their commands the
   * command menu's (`SelectionActions`). Given, the list can be selected from on a phone (mobile D28).
   */
  selection?(): unknown;
  /** After the title and the selection's actions: tabs. */
  default?(): unknown;
  /** At the toolbar's end, on a `bare` one only — its room is not measured: a tab's key hints. */
  end?(): unknown;
  /** More in the display options, after the options that didn't fit the toolbar (why the board is unavailable). */
  display?(): unknown;
  /** At the top of the display options: what they are changed from (a project's saved view). */
  displayHeader?(): unknown;
}>();

const options = defineModel<ListViewOptions>('options', { required: true });

const t = useTranslate();
const phone = useService(PhoneLayout);
const registry = useService(CommandRegistry);

/** What the phone's New issue runs: what `C` runs here — a project's own in a project, else the app's (H1, H5). */
const newIssue = computed(() => registry.findByKey(NEW_ISSUE_KEY));
const sortChoice = computed(() => props.sorts.find(choice => choice.value === options.value.sort));
const grouping = computed(() => props.groupings.find(choice => choice.value === options.value.grouping));
/** The filters a phone's options sheet shows as rows of chips. */
const menuFilters = computed(() =>
  props.filters.filter((filter): filter is ListToolbarMenuOption => filter.kind === 'menu'),
);
/** Whether the phone's options sheet is up. */
const sheetOpen = ref(false);
/** On a phone, the list selecting several items (mobile D28): the top bar counts them, × leaves. */
const selecting = computed(() => phone.selecting && slots.selection !== undefined);

/** Every option, the filters then the view options, in the toolbar's order; none when `bare`. */
const viewOptions = computed((): ListToolbarOption[] => (props.bare ? [] : getViewOptions()));

/**
 * Which options stay on the toolbar when there isn't room for all: the filters, then the layout, the grouping,
 * the order, the properties and the list's own, in that order — the rest move into the display options.
 */
const PRIORITY = ['layout', 'grouping', 'sort', 'properties'];

/** The keys of the options that fit the toolbar; all of them until it has been measured. */
const fitting = ref<ReadonlySet<string> | null>(null);
const onToolbar = computed(() => viewOptions.value.filter(option => !fitting.value || fitting.value.has(option.key)));
/** The options the toolbar has no room for, in the display options. */
const inDisplay = computed(() => viewOptions.value.filter(option => fitting.value && !fitting.value.has(option.key)));

const controls = useTemplateRef<HTMLElement>('controls');
const measure = useTemplateRef<HTMLElement>('measure');
let frame = 0;

// Measured while the toolbar is drawn — not on a phone, whose top bar takes its place, and again once it comes back.
watch(
  [controls, measure],
  ([controlsElement, measureElement], _, onCleanup) => {
    if (!controlsElement || !measureElement) {
      return;
    }

    // A frame later: what `fit` moves resizes what is observed, which must not happen within the observer's turn.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(controlsElement);
    observer.observe(measureElement);
    onCleanup(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    });
  },
  { flush: 'post' },
);

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
useCommands(() =>
  props.bare
    ? []
    : ([
        {
          id: 'view.layout',
          title: options.value.layout === 'list' ? t(l.showAsBoard) : t(l.showAsList),
          section: 'view',
          key: 'Shift+V',
          icon: options.value.layout === 'list' ? Columns3 : List,
          // A phone has no board (mobile D9).
          when: () => !phone.active && (options.value.layout === 'board' || !props.boardDisabled),
          run: () => change({ layout: options.value.layout === 'list' ? 'board' : 'list' }),
        },
        {
          id: 'view.groupBy',
          title: t(l.groupByCommand),
          section: 'view',
          detail: grouping.value?.label,
          icon: Rows3,
          options: () => ({
            options: toCommandOptions(props.groupings, options.value.grouping, value => change({ grouping: value })),
          }),
        },
        {
          id: 'view.orderBy',
          title: t(l.orderByCommand),
          section: 'view',
          detail: sortChoice.value?.label,
          icon: ArrowDownUp,
          options: () => ({
            options: toCommandOptions(props.sorts, options.value.sort, value => change({ sort: value })),
          }),
        },
        ...getOptionCommands(),
        {
          id: 'view.properties',
          title: t(l.showPropertiesCommand),
          section: 'view',
          icon: ListChecks,
          options: () => ({
            several: true,
            options: props.properties.map((choice): CommandOption => {
              const chosen = options.value.properties.includes(choice.value);
              return {
                value: choice.value,
                label: choice.label,
                detail: choice.detail,
                chosen,
                pick: () =>
                  change({
                    properties: chosen
                      ? options.value.properties.filter(property => property !== choice.value)
                      : [...options.value.properties, choice.value],
                  }),
              };
            }),
          }),
        },
        {
          id: 'view.reset',
          title: t(l.resetCommand),
          section: 'view',
          icon: RotateCcw,
          when: () => props.modified,
          run: () => emit('reset'),
        },
      ] satisfies Command[]),
);

/** The filters' and the list's own menu options that name a command: a submenu of their choices. */
function getOptionCommands(): Command[] {
  return [...props.filters, ...props.extraOptions].flatMap((option): Command[] => {
    if (option.kind !== 'menu' || !option.commandTitle) {
      return [];
    }

    return [
      {
        id: `view.${option.key}`,
        title: option.commandTitle,
        section: 'view',
        detail: option.choices.find(choice => choice.value === option.value)?.label,
        icon: option.icon,
        options: () => ({ options: toCommandOptions(option.choices, option.value, option.choose) }),
      },
    ];
  });
}

/** Every option, the filters then the view options, in the toolbar's order. */
function getViewOptions(): ListToolbarOption[] {
  return [
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
  ];
}

/** The choices as a submenu's options: picking one sets it. */
function toCommandOptions(choices: readonly ListChoice[], current: string, choose: (value: string) => void) {
  return choices.map((choice): CommandOption => ({
    value: choice.value,
    label: choice.label,
    detail: choice.detail,
    group: choice.section,
    chosen: choice.value === current,
    pick: () => choose(choice.value),
  }));
}

function change(changes: Partial<ListViewOptions>) {
  options.value = { ...options.value, ...changes };
}
</script>

<template>
  <!-- On a phone (mobile MB32): the places button, the title, the display options and New issue; the rest stays in the command menu. Selecting several (D28, MB117): × and how many are selected, and the options. -->
  <PhoneTopBar
    v-if="phone.active"
    :title="selecting ? t(l.selected, { count: phone.selectedCount }) : title"
  >
    <template
      v-if="selecting"
      #start
    >
      <IconButton
        :icon="X"
        :label="t(l.stopSelecting)"
        @click="phone.setSelecting(false)"
      />
    </template>
    <template #actions>
      <ListOptionsSheet
        v-if="!bare"
        v-model:open="sheetOpen"
        v-model:options="options"
        :title="listName ?? title"
        :place="listName === undefined ? undefined : title"
        :groupings="groupings"
        :sorts="sorts"
        :filters="menuFilters"
        :modified="modified"
        :git-hub-view="gitHubView"
        :selectable="$slots.selection !== undefined"
        :selecting="selecting"
        @reset="emit('reset')"
        @clear-filter="emit('clearFilter')"
        @update:selecting="phone.setSelecting"
      />
      <IconButton
        v-if="newIssue && !selecting"
        :icon="Plus"
        :label="newIssue.title"
        @click="newIssue && registry.run(newIssue)"
      />
      <!-- The selection's commands, for the command menu; nothing drawn here. -->
      <slot name="selection" />
    </template>
  </PhoneTopBar>
  <header
    v-else
    :class="css.listToolbar"
    v-bind="WINDOW_DRAG_REGION"
  >
    <ListTitle :title="title">
      <template
        v-if="$slots.titleMenu"
        #menu
      >
        <slot name="titleMenu" />
      </template>
    </ListTitle>
    <slot name="title" />
    <slot name="selection" />
    <slot />
    <div
      ref="controls"
      :class="css.listToolbar_controls"
    >
      <slot
        v-if="bare"
        name="end"
      />
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
    <ListDisplayOptions
      v-if="!bare"
      :options="inDisplay"
      :modified="modified"
      @reset="emit('reset')"
    >
      <template #header>
        <slot name="displayHeader" />
      </template>
      <slot name="display" />
    </ListDisplayOptions>
  </header>
</template>

<style lang="scss" module="css">
.listToolbar {
  @include list-header;

  position: relative;
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
</style>
