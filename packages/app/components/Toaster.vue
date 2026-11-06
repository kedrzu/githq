<!-- Where toasts appear (reka-ui's `ToastProvider` and `ToastViewport`), the region "Notifications": in the bottom right corner of the window, above the status bar (desktop releases D7). Put the `Toast`s inside it; F8 moves focus to them. They stack in the order they opened, the newest at the bottom, and only the newest takes keys (`ToasterStack`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { ToastProvider, ToastViewport } from 'reka-ui';

import * as l from './Toaster.loc.js';
import { ToasterStack } from './ToasterStack.js';

defineSlots<{
  /** The toasts. */
  default?(): unknown;
}>();

const t = useTranslate();
provideContext(ToasterStack);
</script>

<template>
  <ToastProvider
    :label="t(l.notifications)"
    swipe-direction="right"
  >
    <slot />
    <ToastViewport :class="css.toaster" />
  </ToastProvider>
</template>

<style lang="scss" module="css">
.toaster {
  position: fixed;
  bottom: calc(#{$status-bar-height} + #{$spacing-16});
  right: $spacing-16;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  width: 480px;
  max-width: calc(100vw - #{$spacing-16 * 2});
  padding: 0;
  margin: 0;
  list-style: none;
  outline: none;
}
</style>
