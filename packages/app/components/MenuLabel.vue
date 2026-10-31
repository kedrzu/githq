<!-- A dim heading inside a `Menu` ("Signed in as kedrzu"); not an item, the keyboard skips it. -->
<script lang="ts" setup>
import { DropdownMenuLabel } from 'reka-ui';

defineSlots<{ default(): unknown }>();
</script>

<template>
  <DropdownMenuLabel :class="css.menuLabel"><slot /></DropdownMenuLabel>
</template>

<style lang="scss" module="css">
.menuLabel {
  padding: $spacing-6 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
