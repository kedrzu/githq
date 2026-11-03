<!-- The log map (actions W4a, `Log map`): the whole log, at scale, in lines. Red marks for errors, blue for a search's matches, dividers for steps, a lighter band for what is in view, a line for the cursor. Folded or not, a step takes the height of its lines, and nothing moves as steps fold, only the band. Clicking moves there. For the mouse only: the keys go to the same places. -->
<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{
  /** How many lines the map's height stands for. */
  total: number;
  /** Where the view starts, in lines from the top of the log, as the rest of these. */
  viewTop: number;
  /** How many lines are in view; a folded step in view counts all of its. */
  viewHeight: number;
  /** The map's height, in pixels. */
  height: number;
  /** Where one step gives way to the next. */
  steps: readonly number[];
  /** Where the errors are. */
  errors: readonly number[];
  /** Where a search's matches are. */
  matches?: readonly number[];
  /** Where the cursor is; `null` with none. */
  cursor: number | null;
}>();

const emit = defineEmits<{
  /** A click: the place in the log it means. */
  move: [place: number];
}>();

/** A log's errors and matches may be thousands: those falling on the same marks of the map's height draw one. */
const ERROR_MARK_HEIGHT = 3;
const MATCH_MARK_HEIGHT = 2;
const VIEW_MIN_HEIGHT = 3;

const scale = computed(() => Math.max(props.total, 1));
const errorMarks = computed(() => getMarks(props.errors, ERROR_MARK_HEIGHT));
const matchMarks = computed(() => getMarks(props.matches ?? [], MATCH_MARK_HEIGHT));

function getMarks(places: readonly number[], markHeight: number) {
  const marks = new Set<number>();
  const perMark = (scale.value / Math.max(props.height, 1)) * markHeight;
  for (const place of places) {
    marks.add(Math.floor(place / perMark) * perMark);
  }

  return [...marks];
}

function toPercent(y: number) {
  return `${(y / scale.value) * 100}%`;
}

function move(event: MouseEvent) {
  const map = event.currentTarget;
  if (map instanceof HTMLElement) {
    const { top, height } = map.getBoundingClientRect();
    emit('move', ((event.clientY - top) / height) * scale.value);
  }
}
</script>

<template>
  <div
    :class="css.workflowLogMap"
    aria-hidden="true"
    tid="workflow-log-map"
    @click="move"
  >
    <span
      :class="css.workflowLogMap_view"
      :style="{ top: toPercent(viewTop), height: toPercent(viewHeight), minHeight: `${VIEW_MIN_HEIGHT}px` }"
      tid="workflow-log-map-view"
    />
    <span
      v-for="step in steps"
      :key="step"
      :class="css.workflowLogMap_step"
      :style="{ top: toPercent(step) }"
      tid="workflow-log-map-step"
    />
    <span
      v-for="match in matchMarks"
      :key="`match${match}`"
      :class="css.workflowLogMap_match"
      :style="{ top: toPercent(match) }"
      tid="workflow-log-map-match"
    />
    <span
      v-for="error in errorMarks"
      :key="error"
      :class="css.workflowLogMap_error"
      :style="{ top: toPercent(error) }"
      tid="workflow-log-map-error"
    />
    <span
      v-if="cursor !== null"
      :class="css.workflowLogMap_cursor"
      :style="{ top: toPercent(cursor) }"
    />
  </div>
</template>

<style lang="scss" module="css">
.workflowLogMap {
  position: relative;
  flex: none;
  width: 14px;
  overflow: hidden;
  cursor: pointer;
  background: $color-bg-2;
}

.workflowLogMap_view {
  position: absolute;
  right: 0;
  left: 0;
  background: rgba(#fff, 0.08);
}

.workflowLogMap_step {
  position: absolute;
  right: 0;
  left: 0;
  height: 1px;
  background: $color-border-2;
}

.workflowLogMap_match {
  position: absolute;
  right: 3px;
  left: 3px;
  height: 2px;
  background: $color-accent;
}

.workflowLogMap_error {
  position: absolute;
  right: 3px;
  left: 3px;
  height: 3px;
  background: $color-red;
}

.workflowLogMap_cursor {
  position: absolute;
  right: 0;
  left: 0;
  height: 1px;
  background: $color-fg;
}
</style>
