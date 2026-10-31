<!-- A thin line between the groups of a `Menu`'s items; the keyboard skips it. -->
<script lang="ts" setup>
import { DropdownMenuSeparator } from 'reka-ui';
</script>

<template>
  <DropdownMenuSeparator :class="css.menuSeparator" />
</template>

<style lang="scss" module="css">
.menuSeparator {
  height: 1px;
  margin: $spacing-4 (-$spacing-4);
  background: $color-border-2;
}
</style>
