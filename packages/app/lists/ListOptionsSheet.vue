<!-- A list's options on a phone (mobile D36, D46, D49; MB173–MB175, MB224): the top bar's options button opens one sheet rising from below over the dimmed list. Its head names the list ("Current sprint", under it "Platform Q4 · how this list shows"), Done — or a tap above it — closes it. While the list is changed on this device, one line says so with the way back: "Back to GitHub's view" on a project's saved view, Reset elsewhere. Then only the filtering the desktop has (D46): a project view's filter from GitHub as a chip whose × clears it on this device, a repository's state as a row of chips. Group by and Sort by are rows of single-choice chips — the list's own choices, a row scrolling sideways when it doesn't fit, brought to its chosen chip as the sheet opens — changed in place, the list behind following while the sheet stays up; an order by one key both ways (a project's) is one chip, tapped again to flip its direction. Then, on a list whose items can be selected together, "Select items" (D28), which closes it and turns the rows into checkboxes — its button showing the checklist while they are, and the row reading "Stop selecting". Last, a project's saved view on github.com ↗. The properties rows show, the layout (a phone has no board) and the project's row field stay in the command menu. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, Github, ListChecks, SlidersHorizontal, X } from 'lucide-vue-next';
import { computed, useTemplateRef, watch } from 'vue';

import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import IconButton from '@/components/IconButton.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';

import * as l from './ListOptionsSheet.loc.js';
import type { ListToolbarMenuOption } from './ListToolbarControl.vue';
import type { ListChoice, ListViewOptions } from './ListTypes.js';

const props = withDefaults(
  defineProps<{
    /** The list's name: a project's saved view, a repository's section, "My work". */
    title: string;
    /** Whose list it is, under its name: the project, the repository; none for a list of githq's own (My work). */
    place?: string;
    /** What the list can be grouped by. */
    groupings: readonly ListChoice[];
    /** The orders the list offers; with only one, no row. */
    sorts: readonly ListChoice[];
    /** What narrows the list as the desktop has it (a repository's state), each a row of chips under Filter. */
    filters?: readonly ListToolbarMenuOption[];
    /** The options differ from the list's defaults: a line says so, with the way back. */
    modified?: boolean;
    /**
     * The address on github.com of the saved view the list shows (a project's): the way back reads "Back to GitHub's
     * view", and the sheet ends with a link there. `null` for a list not saved on GitHub.
     */
    gitHubView?: string | null;
    /** The list's items can be selected together (mobile D28): "Select items" is offered. */
    selectable?: boolean;
  }>(),
  { place: undefined, filters: () => [], modified: false, gitHubView: null, selectable: false },
);

const emit = defineEmits<{
  /** Back to the list's defaults. */
  reset: [];
  /** The × of the saved view's filter: cleared on this device. */
  clearFilter: [];
}>();

const open = defineModel<boolean>('open', { default: false });
/** The list is selecting several items (mobile D28): its rows are checkboxes. */
const selecting = defineModel<boolean>('selecting', { default: false });
/** Grouping and order, changed in place; the filter is only shown and cleared through `clearFilter`. */
const options = defineModel<ListViewOptions>('options', { required: true });

const t = useTranslate();
const body = useTemplateRef<HTMLElement>('body');

const description = computed(() =>
  props.place === undefined ? t(l.howItShowsHere) : t(l.howItShows, { place: props.place }),
);
const groupingOptions = computed(() => props.groupings.map(toOption));
/** The orders as chips: one per key of those both ways, labelled with the way chosen, or the key alone. */
const sortOptions = computed(() => {
  const result: SegmentedTabsOption<string>[] = [];
  const keys = new Set<string>();
  for (const choice of props.sorts) {
    const direction = choice.sortDirection;
    if (!direction) {
      result.push(toOption(choice));
      continue;
    }

    if (keys.has(direction.key)) {
      continue;
    }

    keys.add(direction.key);
    const chosen = props.sorts.find(
      candidate => candidate.value === options.value.sort && candidate.sortDirection?.key === direction.key,
    );
    result.push(chosen ? toOption(chosen) : { value: choice.value, label: direction.keyLabel });
  }

  return result;
});

// As it opens, each row of chips scrolls to its chosen one, which may lie past the sheet's edge.
watch(
  body,
  element => {
    for (const chosen of element?.querySelectorAll('[aria-pressed="true"]') ?? []) {
      chosen.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  },
  { flush: 'post' },
);

/** The chosen order's chip tapped again: the same key the other way, where there is one. */
function flip(value: string) {
  const direction = props.sorts.find(choice => choice.value === value)?.sortDirection;
  const other = direction
    ? props.sorts.find(
        choice => choice.sortDirection?.key === direction.key && choice.sortDirection.direction !== direction.direction,
      )
    : undefined;
  if (other) {
    change({ sort: other.value });
  }
}

/** "Select items", or "Stop selecting": the sheet closes onto the list. */
function toggleSelecting() {
  selecting.value = !selecting.value;
  open.value = false;
}

function change(changes: Partial<ListViewOptions>) {
  options.value = { ...options.value, ...changes };
}

function toOption(choice: ListChoice): SegmentedTabsOption<string> {
  return { value: choice.value, label: choice.label };
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="title"
    :description="description"
    edge="bottom"
    bare
    fit-content
  >
    <template #trigger>
      <IconButton
        :icon="selecting ? ListChecks : SlidersHorizontal"
        :label="t(l.display)"
      />
    </template>
    <div :class="css.listOptionsSheet">
      <!-- The dialog's own title and description are what a screen reader hears. -->
      <header :class="css.listOptionsSheet_head">
        <div
          :class="css.listOptionsSheet_heading"
          aria-hidden="true"
        >
          <span :class="css.listOptionsSheet_title">{{ title }}</span>
          <span :class="css.listOptionsSheet_description">{{ description }}</span>
        </div>
        <Button
          variant="ghost"
          tone="accent"
          size="md"
          @click="open = false"
        >
          {{ t(l.done) }}
        </Button>
      </header>
      <div
        ref="body"
        :class="css.listOptionsSheet_body"
      >
        <div
          v-if="modified"
          :class="css.listOptionsSheet_changed"
        >
          <span
            :class="css.listOptionsSheet_dot"
            aria-hidden="true"
          />
          <span :class="css.listOptionsSheet_changedText">{{ t(l.changed) }}</span>
          <Button
            variant="link"
            tone="accent"
            @click="emit('reset')"
          >
            {{ gitHubView ? t(l.backToGitHub) : t(l.reset) }}
          </Button>
        </div>
        <div
          v-if="options.filter || filters.length > 0"
          :class="css.listOptionsSheet_section"
        >
          <span :class="css.listOptionsSheet_label">{{ t(l.filter) }}</span>
          <span
            v-if="options.filter"
            :class="css.listOptionsSheet_filter"
          >
            <span :class="css.listOptionsSheet_filterText">{{ options.filter }}</span>
            <IconButton
              :class="css.listOptionsSheet_clear"
              :icon="X"
              :label="t(l.clearFilter)"
              @click="emit('clearFilter')"
            />
          </span>
          <SegmentedTabs
            v-for="filter in filters"
            :key="filter.key"
            :model-value="filter.value"
            :class="css.listOptionsSheet_chips"
            variant="strip"
            :label="filter.label"
            :options="filter.choices.map(toOption)"
            @update:model-value="filter.choose"
          />
        </div>
        <div :class="css.listOptionsSheet_section">
          <span :class="css.listOptionsSheet_label">{{ t(l.groupBy) }}</span>
          <SegmentedTabs
            :model-value="options.grouping"
            :class="css.listOptionsSheet_chips"
            variant="strip"
            :label="t(l.groupBy)"
            :options="groupingOptions"
            @update:model-value="change({ grouping: $event })"
          />
        </div>
        <div
          v-if="sorts.length > 1"
          :class="css.listOptionsSheet_section"
        >
          <span :class="css.listOptionsSheet_label">{{ t(l.sortBy) }}</span>
          <SegmentedTabs
            :model-value="options.sort"
            :class="css.listOptionsSheet_chips"
            variant="strip"
            :label="t(l.sortBy)"
            :options="sortOptions"
            @update:model-value="change({ sort: $event })"
            @repeat="flip"
          />
        </div>
        <button
          v-if="selectable"
          type="button"
          :class="[css.listOptionsSheet_link, css.listOptionsSheet_select]"
          @click="toggleSelecting"
        >
          <ListChecks
            :class="css.listOptionsSheet_linkIcon"
            aria-hidden="true"
          />
          <span :class="css.listOptionsSheet_linkText">{{ selecting ? t(l.stopSelecting) : t(l.selectItems) }}</span>
        </button>
        <a
          v-if="gitHubView"
          :class="css.listOptionsSheet_link"
          :href="gitHubView"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github
            :class="css.listOptionsSheet_linkIcon"
            aria-hidden="true"
          />
          <span :class="css.listOptionsSheet_linkText">{{ t(l.onGitHub) }}</span>
          <ArrowUpRight
            :class="css.listOptionsSheet_linkIcon"
            aria-hidden="true"
          />
        </a>
      </div>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.listOptionsSheet {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.listOptionsSheet_head {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-12 $spacing-12 $spacing-12 $spacing-20;
  border-bottom: 1px solid $color-border;
}

.listOptionsSheet_heading {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.listOptionsSheet_title {
  overflow: hidden;
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listOptionsSheet_description {
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listOptionsSheet_body {
  min-height: 0;
  padding-bottom: $spacing-8;
  overflow-y: auto;
}

.listOptionsSheet_changed {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: $touch-target-size;
  padding: 0 $spacing-20;
  font-size: $font-size-md;
  color: $color-fg-2;
  background: $color-bg-3;
  border-bottom: 1px solid $color-border;
}

.listOptionsSheet_dot {
  flex: none;
  width: 6px;
  height: 6px;
  background: $color-accent;
  border-radius: 50%;
}

.listOptionsSheet_changedText {
  flex: 1;
  min-width: 0;
}

// Its heading, then its chips; a row of chips runs to the sheet's edges, scrolling sideways.
.listOptionsSheet_section {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  align-items: flex-start;
  padding-top: $spacing-12;
}

// To the sheet's edges, the first chip in line with the heading.
.listOptionsSheet_section > .listOptionsSheet_chips {
  align-self: stretch;
  padding-inline: $spacing-16;
  scroll-padding-inline: $spacing-16;
}

.listOptionsSheet_label {
  padding: 0 $spacing-20;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.listOptionsSheet_filter {
  display: inline-flex;
  gap: $spacing-4;
  align-items: center;
  max-width: 100%;
  height: $phone-pill-height;
  padding: 0 $spacing-4 0 $spacing-12;
  margin: $spacing-4 $spacing-20;
  font-size: $font-size-lg;
  color: $color-fg;
  border: 1px solid $color-border-2;
  border-radius: calc(#{$phone-pill-height} / 2);
}

.listOptionsSheet_filterText {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listOptionsSheet_clear {
  --icon-button-width: 24px;
  --icon-button-height: 24px;
  --icon-button-radius: 12px;
}

.listOptionsSheet_link {
  @include focus-ring;

  display: flex;
  gap: $spacing-12;
  align-items: center;
  min-height: $touch-target-size + $spacing-8;
  padding: 0 $spacing-20;
  margin-top: $spacing-12;
  font-size: $font-size-lg;
  color: $color-fg;
  text-decoration: none;
  border-top: 1px solid $color-border;
}

.listOptionsSheet_linkText {
  flex: 1;
}

// A row of its own as the link is, a button: no border, background or font of a button's own.
.listOptionsSheet_select {
  width: 100%;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  border-top: 1px solid $color-border;
}

// The link right after it keeps one line between them.
.listOptionsSheet_select + .listOptionsSheet_link {
  margin-top: 0;
}

.listOptionsSheet_linkIcon {
  flex: none;
  width: 18px;
  height: 18px;
  color: $color-fg-2;
}
</style>
