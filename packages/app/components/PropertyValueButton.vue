<!-- A property's value that opens its editor — a picker or a field — in an item's properties or a project's card, on nzyme's `useButton`: laid out as the value it is (avatars, label pills, a dot and a name), only lighter while hovered. Put it in a `PropertyRow` of the same `size`; give it an `aria-label` naming the property and its value ("Labels: bug, docs"), which it opens. -->
<script lang="ts">
import { useButton } from '@nzyme/vue-forms/components/useButton.js';
import { defineProp } from '@nzyme/vue-utils/defineProp.js';

/** nzyme's button props (`type`, `busy`, `disabled`, `link`, `noWait`) and the size of the row it is in. */
export const PropertyValueButtonProps = {
  ...useButton.props,
  /** As its `PropertyRow`'s: `card` inside a project's card; `md` when not given. */
  size: defineProp<'card' | 'md'>(),
};
</script>

<script lang="ts" setup>
defineProps(PropertyValueButtonProps);
defineEmits(useButton.emits);
defineSlots<{
  /** The value, as the row shows it when it cannot be changed. */
  default(): unknown;
}>();

const { Button } = useButton();
</script>

<template>
  <Button :class="[css.propertyValueButton, css[`propertyValueButton_${size ?? 'md'}`]]">
    <slot />
  </Button>
</template>

<style lang="scss" module="css">
// Its padding stands out of the row by as much, so the value stays where a plain one would be.
.propertyValueButton {
  @include focus-ring;

  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: $spacing-6 $spacing-8;
  align-items: center;
  min-width: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-3;
  }
}

.propertyValueButton_md {
  padding: 2px $spacing-4;
  margin: -2px (-$spacing-4);
}

.propertyValueButton_card {
  padding: 1px $spacing-4;
  margin: -1px (-$spacing-4);
}
</style>
