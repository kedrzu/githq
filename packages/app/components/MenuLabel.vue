<!-- A dim heading inside a `Menu` ("Signed in as kedrzu"); not an item, the keyboard skips it. In a phone's menu at the bottom (`MenuSheet`) in line with its rows. -->
<script lang="ts" setup>
import { injectContext } from '@nzyme/vue-utils/context.js';
import { DropdownMenuLabel } from 'reka-ui';

import { MenuSheetContext } from './MenuSheetContext.js';

defineSlots<{ default(): unknown }>();

const sheet = injectContext(MenuSheetContext, { optional: true });
</script>

<template>
  <DropdownMenuLabel :class="[css.menuLabel, sheet && css.menuLabel_sheet]"><slot /></DropdownMenuLabel>
</template>

<style lang="scss" module="css">
.menuLabel {
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.menuLabel_sheet {
  padding: $spacing-8 $spacing-20;
  font-size: $font-size-sm;
}
</style>
