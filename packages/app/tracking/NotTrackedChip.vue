<!-- Says in a header that githq does not track what the screen shows. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { EyeOff } from 'lucide-vue-next';

import * as l from './NotTrackedChip.loc.js';

const t = useTranslate();
</script>

<template>
  <span :class="css.notTrackedChip">
    <EyeOff
      :class="css.notTrackedChip_icon"
      aria-hidden="true"
    />
    {{ t(l.notTracked) }}
  </span>
</template>

<style lang="scss" module="css">
.notTrackedChip {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 1px 8px;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
  border: 1px solid $color-border-2;
  border-radius: 10px;
}

.notTrackedChip_icon {
  flex: none;
  width: 12px;
  height: 12px;
}
</style>
