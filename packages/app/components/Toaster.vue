<!-- Where toasts appear (reka-ui's `ToastProvider` and `ToastViewport`), the region "Notifications": in the bottom right corner of the window, above the status bar (desktop releases D7), or `contained` in the one of the positioned element it is in, for a screen's own toasts that live and go with it (code review's discarded comment, above the pending review's toolbar). Put the `Toast`s inside it; F8 moves focus to them. They stack in the order they opened, the newest at the bottom, and only the newest takes keys (`ToasterStack`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { ToastProvider, ToastViewport } from 'reka-ui';

import * as l from './Toaster.loc.js';
import { ToasterStack } from './ToasterStack.js';

defineProps<{
  /** In the bottom right corner of the positioned element it is in, not of the window; its region is named apart from the window's. */
  contained?: boolean;
}>();
defineSlots<{
  /** The toasts. */
  default?(): unknown;
}>();

const t = useTranslate();
provideContext(ToasterStack);

/** Told apart from the window's region, whose key it shares (F8). */
function getContainedLabel(hotkey: string) {
  return t(l.screenNotifications, { hotkey });
}
</script>

<template>
  <ToastProvider
    :label="t(l.notifications)"
    swipe-direction="right"
  >
    <slot />
    <ToastViewport
      :class="contained ? css.toaster_contained : css.toaster"
      :label="contained ? getContainedLabel : undefined"
    />
  </ToastProvider>
</template>

<style lang="scss" module="css">
.toaster,
.toaster_contained {
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

// Inside a screen: in its corner, over what it shows there.
.toaster_contained {
  position: absolute;
  bottom: $spacing-16;
  max-width: calc(100% - #{$spacing-16 * 2});
}
</style>
