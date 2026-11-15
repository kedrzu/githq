<!-- The bar along a phone screen's top (mobile D14, D19, D20), the same on every screen that draws one: at its left the places button, opening the places panel (`PhoneLayout`) — or what the screen puts there instead, back on an item's page — then the screen's title and its actions at the right, every button a finger's size. Under it, only while something holds the whole app back, a strip says so (mobile D12): offline, or refresh paused, which opens why (`PhoneShellContext`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { PanelLeftOpen } from 'lucide-vue-next';

import IconButton from '@/components/IconButton.vue';

import { PhoneLayout } from './PhoneLayout.js';
import { PhoneShellContext } from './PhoneShellContext.js';
import * as l from './PhoneTopBar.loc.js';
import SyncSegment from './SyncSegment.vue';

defineProps<{
  /** The screen's title, the place it shows ("fitloop/webapp"); none on a screen whose content names it. */
  title?: string;
}>();

defineSlots<{
  /** In place of the places button: back, on an item's page. */
  start?(): unknown;
  /** The screen's buttons at the right (`IconButton`s, sized here). */
  actions?(): unknown;
}>();

const t = useTranslate();
const phone = useService(PhoneLayout);
const shell = injectContext(PhoneShellContext, { optional: true });
</script>

<template>
  <header :class="css.phoneTopBar">
    <div :class="css.phoneTopBar_bar">
      <slot name="start">
        <IconButton
          :icon="PanelLeftOpen"
          :label="t(l.openPlaces)"
          aria-haspopup="dialog"
          :aria-expanded="phone.placesOpen"
          @click="phone.setPlacesOpen(true)"
        />
      </slot>
      <h1
        v-if="title"
        :class="css.phoneTopBar_title"
      >
        {{ title }}
      </h1>
      <div :class="css.phoneTopBar_actions">
        <slot name="actions" />
      </div>
    </div>
    <SyncSegment
      v-if="shell?.notice"
      placement="strip"
      :rate-limit="null"
      :notice="shell.notice"
      :last-refreshed-at="shell.lastRefreshedAt"
    />
  </header>
</template>

<style lang="scss" module="css">
.phoneTopBar {
  display: flex;
  flex: none;
  flex-direction: column;
  background: $color-bg;
}

// Every icon button in it a finger's size, the screen's own too.
.phoneTopBar_bar {
  @include touch-icon-buttons($phone-icon-size);

  display: flex;
  gap: $spacing-4;
  align-items: center;
  height: $phone-top-bar-height;
  padding: 0 $spacing-6;
  border-bottom: 1px solid $color-border;
}

.phoneTopBar_title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phoneTopBar_actions {
  display: flex;
  flex: none;
  gap: $spacing-2;
  align-items: center;
  margin-left: auto;
}
</style>
