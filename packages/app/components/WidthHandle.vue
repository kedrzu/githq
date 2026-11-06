<!-- The handle on the left or right edge of a dialog centred in the window (its parent, which it is drawn in the edge of): dragging it widens or narrows the box by as much on both sides, so the edge stays under the pointer, the arrow keys too, the width staying between `min` and the window less its `margin`. Only for a centred dialog: panels beside each other are resized through Reka's splitter (`ColumnSplit`, or `SplitterGroup` + `ResizeHandle` + `usePanelWidth`), never by this. Drawn as `ResizeHandle` is — a line lit up while hovered, dragged or focused; the mouse takes no focus, so a key after a drag doesn't light it. `resized` tells when the user is done: they let go of it, or released an arrow key. -->
<script lang="ts" setup>
import { ref } from 'vue';

import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';

const props = defineProps<{
  /** What it resizes, for screen readers ("Resize window"). */
  label: string;
  side: 'left' | 'right';
  min: number;
  /** What it leaves of the window either side of the box, at least. */
  margin?: number;
}>();

const emit = defineEmits<{
  resized: [];
}>();

/** The box's width in pixels. */
const width = defineModel<number>({ required: true });

const KEYBOARD_STEP = 20;

const dragging = ref(false);
let start: { x: number; width: number } | null = null;

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
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

/** The width the box is drawn at — narrower than `width` when the window is. */
function getBoxWidth(event: Event) {
  return (event.currentTarget as HTMLElement).parentElement?.getBoundingClientRect().width ?? width.value;
}

/** Within the range. */
function clamp(next: number) {
  const widest = window.innerWidth - (props.margin ?? 0) * 2;
  return Math.round(Math.max(props.min, Math.min(widest, next)));
}
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    :aria-valuenow="width"
    :aria-valuemin="min"
    tabindex="0"
    :data-state="dragging ? 'drag' : undefined"
    :class="[css.widthHandle, side === 'left' ? css.widthHandle_left : css.widthHandle_right]"
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
