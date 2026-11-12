<!-- A column beside a pane, left of it by default or right of it (`side`): the column (`column`), when `shown`, and the pane (the default slot), which stays mounted as the column comes and goes. The width is the user's on this device (`width`: its key, default and range), dragged by the column's inner edge (`label` names it) or changed with the arrow keys on it. The pane keeps at least `paneMin` px (400 by default), the column giving way down to its minimum while the width the user chose stays kept and returns when there is room again. Its root sets `--column-split-width` to the width shown (the kept one while the column is not shown), for what in the pane follows it. Panels beside each other are resized through Reka's splitter, here or as `SplitterGroup` + `ResizeHandle` + `usePanelWidth` where this doesn't fit, never by a handle of their own. -->
<script lang="ts" setup>
import { SplitterGroup, SplitterPanel } from 'reka-ui';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, useTemplateRef, watch } from 'vue';

import ResizeHandle from './ResizeHandle.vue';
import { usePanelWidth } from './usePanelWidth.js';
import type { PanelWidthOptions } from './usePanelWidth.js';

const props = defineProps<{
  /** Whether the column is there; the pane has all the width when it is not. */
  shown: boolean;
  /** The column's width: where it is kept, its default and the range it is dragged in. */
  width: PanelWidthOptions;
  /** What the edge resizes, for screen readers ("Resize the file list"). */
  label: string;
  /** Which side of the pane the column is on; left by default. */
  side?: 'left' | 'right';
  /** What is left to the pane, at least, in pixels; 400 by default. */
  paneMin?: number;
}>();

defineSlots<{
  /** The column; fills its panel, whose inner border is the line beside the pane. */
  column?(): unknown;
  /** The pane. */
  default?(): unknown;
}>();

// The options are read once: a split's width does not change what it is.
const columnWidth = usePanelWidth(props.width);
const group = useTemplateRef<InstanceType<typeof SplitterGroup>>('group');
// Set by a function: a template ref in a `v-for` would be a list.
const columnPanel = shallowRef<InstanceType<typeof SplitterPanel> | null>(null);
// One instance's own: a split can sit inside the pane of another, and two elements must not share an id.
const panelId = useId();

/** The panels' width together: not the window's, which holds the sidebar and any item panel too. */
const groupWidth = ref(0);
/** Short of `paneMin` on a very small window, as the column does not go under its minimum. */
const paneMinWidth = computed(() => Math.max(0, Math.min(groupWidth.value - columnWidth.min, props.paneMin ?? 400)));
/** The panels and the edge in the order they are laid out, which is Reka's order of the panels too. */
const parts = computed(() =>
  props.side === 'right' ? (['pane', 'edge', 'column'] as const) : (['column', 'edge', 'pane'] as const),
);
const paneMinSize = computed(() => (groupWidth.value > 0 ? (paneMinWidth.value / groupWidth.value) * 100 : 0));

let observer: ResizeObserver | undefined;
onMounted(() => {
  const element: unknown = group.value?.$el;
  if (element instanceof HTMLElement) {
    groupWidth.value = element.clientWidth;
    observer = new ResizeObserver(([entry]) => {
      if (entry) {
        groupWidth.value = entry.contentRect.width;
      }
    });
    observer.observe(element);
  }
});
onBeforeUnmount(() => observer?.disconnect());

// A new minimum lays the panels out anew, as does the column coming: from the `default-size` it had when it mounted,
// not the one it has now, so the width the user chose is put back, or as much of it as there is room for.
watch(paneMinSize, restoreWidth);

async function restoreWidth() {
  await nextTick();
  columnPanel.value?.resize(columnWidth.stored);
}

// The column's width now, in pixels, from the panels in their order; with no column, the group reports the pane, in percent.
function onLayout(sizes: number[]) {
  const column = sizes[props.side === 'right' ? 1 : 0];
  if (props.shown && column !== undefined) {
    columnWidth.current = column;
  }
}

// The handle reports any key released on it and any press, moved or not: a column squeezed to all the room there is
// has not been resized, and the wider width the user chose stays kept.
function saveWidth() {
  const squeezed =
    columnWidth.current < columnWidth.stored && columnWidth.current >= groupWidth.value - paneMinWidth.value - 1;
  if (!squeezed) {
    columnWidth.save();
  }
}
</script>

<template>
  <!-- Ids and orders keep the panels apart: a column mounting late would otherwise land beside the wrong side of the pane. -->
  <SplitterGroup
    ref="group"
    direction="horizontal"
    :class="css.columnSplit"
    :style="{ '--column-split-width': `${shown ? columnWidth.current : columnWidth.stored}px` }"
    @layout="onLayout"
  >
    <template
      v-for="(part, order) in parts"
      :key="part"
    >
      <SplitterPanel
        v-if="part === 'column' && shown"
        :id="`${panelId}-column`"
        :ref="panel => (columnPanel = panel as InstanceType<typeof SplitterPanel> | null)"
        :order="order"
        size-unit="px"
        :default-size="columnWidth.stored"
        :min-size="columnWidth.min"
        :max-size="columnWidth.max"
        :style="columnWidth.style"
        :class="[css.columnSplit_column, side === 'right' ? css.columnSplit_column_right : css.columnSplit_column_left]"
        @vue:mounted="restoreWidth"
      >
        <slot name="column" />
      </SplitterPanel>
      <!-- Always there, only turned on: Reka listens for the arrow keys on a handle in the group when the group mounts or it is enabled, so one mounting late would never hear them. -->
      <ResizeHandle
        v-else-if="part === 'edge'"
        v-show="shown"
        :label="label"
        :disabled="!shown"
        @resized="saveWidth"
      />
      <SplitterPanel
        v-else-if="part === 'pane'"
        :id="`${panelId}-pane`"
        :order="order"
        :min-size="paneMinSize"
        :class="css.columnSplit_pane"
      >
        <slot />
      </SplitterPanel>
    </template>
  </SplitterGroup>
</template>

<style lang="scss" module="css">
.columnSplit {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.columnSplit_column {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.columnSplit_column_left {
  border-right: 1px solid $color-border;
}

.columnSplit_column_right {
  border-left: 1px solid $color-border;
}

.columnSplit_pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
</style>
