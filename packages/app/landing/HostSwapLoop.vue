<!-- An address whose host swaps from github.com to githq.dev (githq.pen "Landing — motion storyboard", the address bar): the host, a caret after it while it blinks or types, and the path, as flex items of the bar its parent draws. `useHostSwap` times the steps; the address in githq is what screen readers get, whatever the step. -->
<script lang="ts" setup>
import { GITHQ_HOST, SWAP_PATH } from './useHostSwap.js';
import type { HostSwapStep } from './useHostSwap.js';

defineProps<{
  step: HostSwapStep;
  /** The host shown at this step: part of githq's while it types in. */
  host: string;
}>();
</script>

<template>
  <span
    :class="css.hostSwapLoop"
    :data-step="step"
    aria-hidden="true"
    ><span :class="css.hostSwapLoop_host">{{ host }}</span
    ><span :class="css.hostSwapLoop_path">{{ SWAP_PATH }}</span></span
  ><span :class="css.hostSwapLoop_hidden">{{ GITHQ_HOST }}{{ SWAP_PATH }}</span>
</template>

<style lang="scss" module="css">
// Its parts are the bar's own flex items.
.hostSwapLoop {
  display: contents;
}

// The storyboard's highlight box, its padding outside the text so the host sits where an unanimated one would.
.hostSwapLoop_host {
  position: relative;
  flex: none;
  padding: 1px $spacing-2;
  margin-inline: -$spacing-2;
  font-weight: $font-weight-semibold;
  color: $color-accent;
  border-radius: $radius-sm;

  // GitHub's host is plain text, like the rest of the address.
  .hostSwapLoop:is([data-step='github'], [data-step='selected']) & {
    color: inherit;
  }

  // As if double-clicked.
  .hostSwapLoop[data-step='selected'] & {
    background: rgba($color-accent, 0.3);
  }

  // The caret, out of the flow so it moves nothing.
  &::after {
    position: absolute;
    top: 50%;
    right: 0;
    width: 1.5px;
    height: 14px;
    content: '';
    background: $color-accent;
    opacity: 0;
    translate: 0 -50%;
  }

  .hostSwapLoop:is([data-step='github'], [data-step='typing']) &::after {
    opacity: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: background-color 150ms ease-out;

    .hostSwapLoop[data-step='github'] &::after {
      animation: caret-blink 1s steps(1) infinite;
    }
  }
}

.hostSwapLoop_path {
  min-width: 0;
  overflow: hidden;
  color: $color-fg-2;
  text-overflow: ellipsis;
}

.hostSwapLoop_hidden {
  @include visually-hidden;
}

@keyframes caret-blink {
  50% {
    opacity: 0;
  }
}
</style>
