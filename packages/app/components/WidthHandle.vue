<!-- The handle on the left or right edge of a box (its parent, which it is drawn in the edge of): dragging it widens or narrows the box, the arrow keys too. Either the box is centred in the window (a resizable dialog), and it changes by as much on both sides so the edge stays under the pointer, the width staying between `min` and the window less its `margin`; or it is `anchored` (a side panel), its other edge staying, the width between `min` and `max`, and where there is less room than `min` the handle changes nothing. Drawn as `ResizeHandle` is — a line lit up while hovered, dragged or focused; the mouse takes no focus, so a key after a drag doesn't light it. `resized` tells when the user is done: they let go of it, or released an arrow key. -->
<script lang="ts" setup>
import { ref } from 'vue';

import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';

const props = defineProps<{
  /** What it resizes, for screen readers ("Resize window"). */
  label: string;
  side: 'left' | 'right';
  min: number;
  /** A box centred in the window: what it leaves of the window either side of it, at least. */
  margin?: number;
  /** An `anchored` box: the widest it may be, when that is known. */
  max?: number;
  /** The box's other edge stays where it is: the width changes by what the pointer moved, not twice that. */
  anchored?: boolean;
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
    const next = clamp(start.width + moved * getReach());
    if (next !== null) {
      width.value = next;
    }
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
  const drawn = getBoxWidth(event);
  const next = clamp(drawn + step * getReach());
  // An anchored box already as wide as it may be is not "resized" to the width it is drawn at: that would keep a squeezed width.
  if (next !== null && !(props.anchored && next === Math.round(drawn))) {
    width.value = next;
  }
}

/** The width the box is drawn at — narrower than `width` when the window is. */
function getBoxWidth(event: Event) {
  return (event.currentTarget as HTMLElement).parentElement?.getBoundingClientRect().width ?? width.value;
}

/** How much the box changes by what an edge moves: both its edges move when it is centred. */
function getReach() {
  return props.anchored ? 1 : 2;
}

/** Within the range; none for an anchored box with less room than `min`: there is no width to choose, so nothing changes. */
function clamp(next: number) {
  const widest = props.anchored ? (props.max ?? Infinity) : window.innerWidth - (props.margin ?? 0) * 2;
  return props.anchored && widest < props.min ? null : Math.round(Math.max(props.min, Math.min(widest, next)));
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
