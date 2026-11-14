<!-- A pill-shaped button floating over a phone screen's bottom (mobile D17), on nzyme's `useButton`: as tall as a thumb's tap, raised off what scrolls under it by its shadow, its content from the start — the command line's "Do or find…" and "Leave a comment…". -->
<script lang="ts">
import { useButton } from '@nzyme/vue-forms/components/useButton.js';

/** nzyme's button props (`type`, `busy`, `disabled`, `link`, `noWait`). */
export const PhonePillProps = {
  ...useButton.props,
};
</script>

<script lang="ts" setup>
defineProps(PhonePillProps);
defineEmits(useButton.emits);
defineSlots<{
  /** What it says, as a field's placeholder would. */
  default(): unknown;
}>();

const { Button, busy } = useButton();
</script>

<template>
  <Button
    :class="css.phonePill"
    :aria-busy="busy || undefined"
  >
    <slot />
  </Button>
</template>

<style lang="scss" module="css">
.phonePill {
  @include focus-ring;

  display: flex;
  flex: 1;
  gap: $spacing-10;
  align-items: center;
  min-width: 0;
  height: $phone-command-line-height;
  padding: 0 $spacing-16;
  font: inherit;
  font-size: $font-size-xl;
  color: $color-fg-dim;
  text-align: left;
  cursor: pointer;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: calc(#{$phone-command-line-height} / 2);
  box-shadow: $shadow-phone-command-line;
}
</style>
