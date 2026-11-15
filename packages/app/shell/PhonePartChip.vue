<!-- The chip naming the part of the place a phone's list shows (`PhoneLayout.part`, mobile D17): its label, a dot when it is a project view changed on this device (D49) and its count when the screen says one. The command line draws it, and the command menu it opens, in its field (MB223). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { PhonePart } from './PhoneLayout.js';
import * as l from './PhonePartChip.loc.js';

defineProps<{
  part: PhonePart;
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<template>
  <span :class="css.phonePartChip">
    <span :class="css.phonePartChip_label">{{ part.label }}</span>
    <span
      v-if="part.changed"
      :class="css.phonePartChip_changed"
      role="img"
      :aria-label="t(l.changed)"
    />
    <span
      v-if="part.count != null"
      :class="css.phonePartChip_count"
      >{{ numbers.format(part.count) }}</span
    >
  </span>
</template>

<style lang="scss" module="css">
.phonePartChip {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: baseline;
  max-width: 50%;
  padding: $spacing-4 $spacing-8;
  font-size: $font-size-md;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.phonePartChip_label {
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg;
  white-space: nowrap;
}

.phonePartChip_changed {
  flex: none;
  align-self: center;
  width: 6px;
  height: 6px;
  background: $color-accent;
  border-radius: 50%;
}

.phonePartChip_count {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
