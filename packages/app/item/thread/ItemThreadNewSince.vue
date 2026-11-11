<!-- Where what others did since the viewer last looked at the item starts in its thread (`Activity / New since you looked`, F5): "3 new since you looked" in the accent, and an accent rule to the thread's right edge, level with the cards. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './ItemThreadNewSince.loc.js';

defineProps<{
  /** The items from here on not the viewer's own. */
  count: number;
}>();

const t = useTranslate();
</script>

<template>
  <div :class="css.itemThreadNewSince">
    <span :class="css.itemThreadNewSince_text">{{ t(l.newSince, { count }) }}</span>
    <span
      :class="css.itemThreadNewSince_rule"
      aria-hidden="true"
    />
  </div>
</template>

<style lang="scss" module="css">
// Indented as the cards are, past the avatars' gutter.
.itemThreadNewSince {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  padding: $spacing-4 0 $spacing-4 ($item-thread-gutter-width + $item-thread-gutter-gap);
}

.itemThreadNewSince_text {
  flex: none;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: $color-accent;
}

.itemThreadNewSince_rule {
  flex: 1;
  height: 1px;
  background: $color-accent;
}
</style>
