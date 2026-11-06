<!-- An arrow that comes in from the window's edge as a two-finger swipe goes back (from the left) or forward (from the right), and lights up once letting go goes there (`useHistorySwipe`). The desktop app on a Mac only: the browsers have their own. -->
<script lang="ts" setup>
import { ArrowLeft, ArrowRight } from 'lucide-vue-next';

import { useHistorySwipe } from './useHistorySwipe.js';

const swipe = useHistorySwipe();
</script>

<template>
  <div
    v-if="swipe.direction"
    :class="[
      css.historySwipe,
      swipe.direction === 'forward' && css.historySwipe_forward,
      swipe.progress === 1 && css.historySwipe_ready,
    ]"
    :style="{ '--progress': swipe.progress }"
    aria-hidden="true"
  >
    <component
      :is="swipe.direction === 'back' ? ArrowLeft : ArrowRight"
      :size="18"
    />
  </div>
</template>

<style lang="scss" module="css">
// The page never scrolls sideways, so a swipe meets its edge at once: no rubber band of the whole page under the arrow.
// Elements that do scroll sideways keep theirs, and the page keeps its own up and down.
:global(html) {
  overscroll-behavior-x: none;
}

.historySwipe {
  position: fixed;
  top: 50%;
  left: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: $color-fg-2;
  pointer-events: none;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: 50%;
  box-shadow: $shadow-popover;
  opacity: var(--progress);
  transform: translate(calc(-100% + var(--progress) * (100% + 16px)), -50%);

  @include motion {
    transition:
      color 0.1s,
      background-color 0.1s,
      border-color 0.1s;
  }
}

.historySwipe_forward {
  right: 0;
  left: auto;
  transform: translate(calc(100% - var(--progress) * (100% + 16px)), -50%);
}

.historySwipe_ready {
  color: $color-on-light;
  background: $color-accent;
  border-color: $color-accent;
}
</style>
