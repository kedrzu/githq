<!-- A thin line between the groups of a `Menu`'s items; the keyboard skips it. In a phone's menu at the bottom (`MenuSheet`) across the whole sheet. -->
<script lang="ts" setup>
import { injectContext } from '@nzyme/vue-utils/context.js';
import { DropdownMenuSeparator } from 'reka-ui';

import { MenuSheetContext } from './MenuSheetContext.js';

const sheet = injectContext(MenuSheetContext, { optional: true });
</script>

<template>
  <DropdownMenuSeparator :class="[css.menuSeparator, sheet && css.menuSeparator_sheet]" />
</template>

<style lang="scss" module="css">
.menuSeparator {
  height: 1px;
  margin: $spacing-4 (-$spacing-4);
  background: $color-border-2;
}

.menuSeparator_sheet {
  margin: $spacing-4 0;
  background: $color-border;
}
</style>
