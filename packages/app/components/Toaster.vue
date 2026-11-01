<!-- Where toasts appear (reka-ui's `ToastProvider` and `ToastViewport`), the region "Notifications": along the bottom of the window, above the status bar, centred under the screen. Put the `Toast`s inside it; F8 moves focus to them. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ToastProvider, ToastViewport } from 'reka-ui';

import * as l from './Toaster.loc.js';

defineSlots<{
  /** The toasts. */
  default?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <ToastProvider
    :label="t(l.notifications)"
    swipe-direction="down"
  >
    <slot />
    <ToastViewport :class="css.toaster" />
  </ToastProvider>
</template>

<style lang="scss" module="css">
.toaster {
  position: fixed;
  bottom: calc(#{$status-bar-height} + #{$spacing-16});
  left: 50%;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  width: 580px;
  max-width: calc(100vw - #{$spacing-24 * 2});
  padding: 0;
  margin: 0;
  list-style: none;
  outline: none;
  transform: translateX(-50%);
}
</style>
