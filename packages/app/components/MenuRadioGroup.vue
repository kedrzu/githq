<!-- One choice out of several inside a `Menu` (reka-ui's `DropdownMenuRadioGroup`): its items are `MenuRadioItem`s, the chosen one checked; picking one changes the choice and closes the menu. A list's grouping ("Group: Milestone") is chosen in one. -->
<script lang="ts" setup>
import { DropdownMenuRadioGroup } from 'reka-ui';

defineSlots<{
  /** The `MenuRadioItem`s, `MenuLabel`s between them. */
  default(): unknown;
}>();

const model = defineModel<string>({ required: true });
</script>

<template>
  <DropdownMenuRadioGroup v-model="model">
    <slot />
  </DropdownMenuRadioGroup>
</template>
