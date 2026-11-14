<!-- The handle on the left or right edge of a box centred in its parent (the box is the handle's parent, which it is drawn in the edge of, top to bottom): dragging it widens or narrows the box by as much on both sides, so the edge stays under the pointer, the arrow keys too, the width staying between `min` and `max`. Only for a centred box: panels beside each other are resized through Reka's splitter (`ColumnSplit`, or `SplitterGroup` + `ResizeHandle` + `usePanelWidth`), never by this. Drawn as `ResizeHandle` is — a line lit up while hovered, dragged or focused; the mouse takes no focus, so a key after a drag doesn't light it. `resized` tells when the user is done: they let go of it, or released an arrow key. With `inset` it is drawn that far inside the box's edge, over a line of the box's content (the code review's files, whose edge it is), and `quiet` lights nothing while hovered or dragged — the cursor alone tells it — only while focused from the keyboard. -->
<script lang="ts" setup>
import { ref } from 'vue';

import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';

const props = defineProps<{
  /** What it resizes, for screen readers ("Resize the item"). */
  label: string;
  side: 'left' | 'right';
  min: number;
  /** The widest the box may be, such as the `clientWidth` of what it is centred in. */
  max: number;
  /** How far inside the box's edge the handle is centred, in pixels; none: at the edge, inside it. */
  inset?: number;
  /** Lit only while focused from the keyboard: the edge it lies on is the content's own. */
  quiet?: boolean;
}>();

const emit = defineEmits<{
  resized: [];
}>();

/** The box's width in pixels. */
const width = defineModel<number>({ required: true });

const KEYBOARD_STEP = 20;
/** `.widthHandle`'s width. */
const HANDLE_WIDTH = 6;

const dragging = ref(false);
let start: { x: number; width: number } | null = null;

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  if (event.currentTarget instanceof Element) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  start = { x: event.clientX, width: getBoxWidth(event) };
  dragging.value = true;
}

function onPointerMove(event: PointerEvent) {
  if (start) {
    const moved = props.side === 'right' ? event.clientX - start.x : start.x - event.clientX;
    // Both edges move, the box being centred.
    width.value = clamp(start.width + moved * 2);
  }
}

function onPointerUp() {
  if (start) {
    start = null;
    dragging.value = false;
    emit('resized');
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!isSingleKeyShortcut(event)) {
    return;
  }

  const outwards = props.side === 'right' ? 'ArrowRight' : 'ArrowLeft';
  const inwards = props.side === 'right' ? 'ArrowLeft' : 'ArrowRight';
  if (event.key !== outwards && event.key !== inwards) {
    return;
  }

  event.preventDefault();
  const step = event.key === outwards ? KEYBOARD_STEP : -KEYBOARD_STEP;
  width.value = clamp(getBoxWidth(event) + step * 2);
}

/** The width the box is drawn at, narrower than `width` when there is no room for what is kept. */
function getBoxWidth(event: Event) {
  const box = event.currentTarget instanceof Element ? event.currentTarget.parentElement : null;
  return box?.getBoundingClientRect().width ?? width.value;
}

/** Within the range; `min` wins over a `max` below it. */
function clamp(next: number) {
  return Math.round(Math.max(props.min, Math.min(props.max, next)));
}
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    :aria-valuenow="width"
    :aria-valuemin="min"
    :aria-valuemax="max"
    tabindex="0"
    :data-state="dragging ? 'drag' : undefined"
    :class="[
      css.widthHandle,
      side === 'left' ? css.widthHandle_left : css.widthHandle_right,
      quiet && css.widthHandle_quiet,
    ]"
    :style="inset === undefined ? undefined : { [side]: `${inset - HANDLE_WIDTH / 2}px` }"
    @mousedown.prevent
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @keydown="onKeydown"
    @keyup="emit('resized')"
  />
</template>

<style lang="scss" module="css">
.widthHandle {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 6px;
  cursor: col-resize;
  outline: none;
  touch-action: none;

  // Along the box's edge.
  &::before {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    content: '';
    background: transparent;

    @include motion {
      transition: background-color 0.1s;
    }
  }

  &:hover::before,
  &[data-state='drag']::before,
  &:focus-visible::before {
    background: $color-accent;
  }
}

.widthHandle_quiet {
  // On the content's line, in its middle.
  &::before {
    right: auto;
    left: calc(50% - 1px);
  }

  &:hover::before,
  &[data-state='drag']::before {
    background: transparent;
  }

  &:focus-visible::before {
    background: $color-accent;
  }
}

.widthHandle_left {
  left: 0;

  &::before {
    left: 0;
  }
}

.widthHandle_right {
  right: 0;

  &::before {
    right: 0;
  }
}
</style>
