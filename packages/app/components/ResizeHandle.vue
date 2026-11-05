<!-- The handle between two panels of a `SplitterGroup` (Reka UI): it takes no width — the panels' own borders are the line — and lights the line up while hovered, dragged or focused (the arrow keys resize too). `resized` tells when the user is done: they let go of it, or released an arrow key. -->
<script lang="ts" setup>
import { SplitterResizeHandle } from 'reka-ui';

defineProps<{
  /** What it resizes, for screen readers ("Resize sidebar"). */
  label: string;
}>();

const emit = defineEmits<{
  resized: [];
}>();

function onDragging(dragging: boolean) {
  if (!dragging) {
    emit('resized');
  }
}
</script>

<template>
  <SplitterResizeHandle
    :class="css.resizeHandle"
    :aria-label="label"
    @dragging="onDragging"
    @keyup="emit('resized')"
  />
</template>

<style lang="scss" module="css">
.resizeHandle {
  position: relative;
  z-index: 1;
  flex: none;
  width: 0;
  outline: none;

  // Over the panels' borders either side of it.
  &::before {
    position: absolute;
    inset: 0 -1px;
    content: '';
    background: transparent;

    @include motion {
      transition: background-color 0.1s;
    }
  }

  &[data-state='hover']::before,
  &[data-state='drag']::before,
  &:focus-visible::before {
    background: $color-accent;
  }
}

// The resize cursor, over the whole page while a handle is hovered (within its hit area, wider than the handle) or
// dragged. Reka UI sets it from a `<style>` it adds to the page, which the desktop app's content security policy blocks;
// a rule in the app's own stylesheet it lets through.
html:has(.resizeHandle[data-state='hover'], .resizeHandle[data-state='drag']) * {
  cursor: col-resize !important;
}
</style>
