<!-- What a phone pins above its on-screen keyboard while a task is open (mobile D18, D51: an item's composer grown from the command line's pill): the screen's width, its bottom on the keyboard's top — the visual viewport's (`useVisualViewport`), which the keyboard shrinks while the window stays the same, so CSS alone can't follow it in Safari — and no taller than what the keyboard leaves under the top bar. Over the screen, out of its layout (on the page's body); while it is there the command line steps aside (`PhoneLayout.openTask`). A press outside it closes it (`close`): not one while a menu or a sheet stands over it, which closes that first. How much of the window's bottom it covers, the keyboard included, is reported (`cover`), so the screen's scroll can end above it. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watchEffect } from 'vue';

import { PhoneLayout } from './PhoneLayout.js';
import { useVisualViewport } from './useVisualViewport.js';

const emit = defineEmits<{
  /** A press outside it. */
  close: [];
}>();

defineSlots<{
  /** What is docked: one block, as tall as it needs, scrolling within itself past the room there is. */
  default(): unknown;
}>();

/** The height of the window's bottom it covers, the keyboard's included, in pixels. */
const cover = defineModel<number>('cover', { default: 0 });

const phoneLayout = useService(PhoneLayout);
const viewport = useVisualViewport();
const rootRef = useTemplateRef<HTMLElement>('root');
const height = ref(0);
const closeTask = phoneLayout.openTask();
let observer: ResizeObserver | undefined;

watchEffect(() => {
  cover.value = height.value + viewport.bottomInset;
});

onMounted(() => {
  observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      height.value = Math.round(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height);
    }
  });
  if (rootRef.value) {
    observer.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  closeTask();
  cover.value = 0;
});

// A menu or a sheet it opened stands over it in a layer of its own: a press there, or on the dimmed screen around it,
// is theirs.
onWindowEvent('pointerdown', event => {
  const { target } = event;
  if (!(target instanceof Node) || rootRef.value?.contains(target)) {
    return;
  }

  if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) {
    return;
  }

  emit('close');
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="root"
      :class="[css.phoneKeyboardDock, viewport.bottomInset > 0 && css.phoneKeyboardDock_keyboard]"
      :style="{ bottom: `${viewport.bottomInset}px`, '--phone-keyboard-dock-room': `${viewport.height}px` }"
    >
      <slot />
    </div>
  </Teleport>
</template>

<style lang="scss" module="css">
// Under the menus and sheets it opens (a dialog's layer), over the screen as the command line is.
.phoneKeyboardDock {
  position: fixed;
  right: 0;
  left: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  max-height: calc(var(--phone-keyboard-dock-room) - #{$phone-top-bar-height} - env(safe-area-inset-top, 0px));
  // With the keyboard down, clear of the home indicator.
  padding-bottom: $phone-home-indicator-room;
  background: $color-bg-2;
}

.phoneKeyboardDock_keyboard {
  padding-bottom: 0;
}
</style>
