<!-- A left column beside a pane: the column (`column`), when `shown`, and the pane (the default slot), which stays mounted as the column comes and goes. The width is the user's on this device (`width`: its key, default and range), dragged by the column's right edge (`label` names it) or changed with the arrow keys on it. The pane keeps at least 400 px, the column giving way down to its minimum while the width the user chose stays kept and returns when there is room again. Its root sets `--column-split-width` to the width shown (the kept one while the column is not shown), for what in the pane follows it. -->
<script lang="ts" setup>
import { SplitterGroup, SplitterPanel } from 'reka-ui';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue';

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
}>();

defineSlots<{
  /** The column; fills its panel, whose right border is the line beside the pane. */
  column?(): unknown;
  /** The pane. */
  default?(): unknown;
}>();

/** What is left to the pane, at least, in pixels. */
const PANE_MIN_WIDTH = 400;

// The options are read once: a split's width does not change what it is.
const columnWidth = usePanelWidth(props.width);
const group = useTemplateRef<InstanceType<typeof SplitterGroup>>('group');
const columnPanel = useTemplateRef<InstanceType<typeof SplitterPanel>>('columnPanel');
// One instance's own: a split can sit inside the pane of another, and two elements must not share an id.
const panelId = useId();

/** The panels' width together: not the window's, which holds the sidebar and any item panel too. */
const groupWidth = ref(0);
/** Short of 400 px on a very small window, as the column does not go under its minimum. */
const paneMinWidth = computed(() => Math.max(0, Math.min(groupWidth.value - columnWidth.min, PANE_MIN_WIDTH)));
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

// The column's width now, in pixels, from `[column, pane]`; with no column, the group reports the pane, in percent.
function onLayout(sizes: number[]) {
  const [column] = sizes;
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
  <!-- Ids and orders keep the panels apart: a column mounting late would otherwise land after the pane. -->
  <SplitterGroup
    ref="group"
    direction="horizontal"
    :class="css.columnSplit"
    :style="{ '--column-split-width': `${shown ? columnWidth.current : columnWidth.stored}px` }"
    @layout="onLayout"
  >
    <SplitterPanel
      v-if="shown"
      :id="`${panelId}-column`"
      ref="columnPanel"
      :order="0"
      size-unit="px"
      :default-size="columnWidth.stored"
      :min-size="columnWidth.min"
      :max-size="columnWidth.max"
      :style="columnWidth.style"
      :class="css.columnSplit_column"
      @vue:mounted="restoreWidth"
    >
      <slot name="column" />
    </SplitterPanel>
    <!-- Always there, only turned on: Reka listens for the arrow keys on a handle in the group when the group mounts or it is enabled, so one mounting late would never hear them. -->
    <ResizeHandle
      v-show="shown"
      :label="label"
      :disabled="!shown"
      @resized="saveWidth"
    />
    <SplitterPanel
      :id="`${panelId}-pane`"
      :order="1"
      :min-size="paneMinSize"
      :class="css.columnSplit_pane"
    >
      <slot />
    </SplitterPanel>
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
  border-right: 1px solid $color-border;
}

.columnSplit_pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
</style>
