<!-- One of the actions a list row reveals when swiped left on a phone (mobile D27, MB114), on nzyme's `useButton`: a tile the row's full height, its icon over its name, filled by its `tone` — `quiet` grey (Status), `blue` (Assign), `violet` (Close). Its name is its accessible name; as a menu's trigger it takes the menu's handlers and ARIA. -->
<script lang="ts">
import { useButton } from '@nzyme/vue-forms/components/useButton.js';
import { defineProp } from '@nzyme/vue-utils/defineProp.js';
import type { LucideIcon } from 'lucide-vue-next';

/** nzyme's button props, its icon and its fill. */
export const RowSwipeTileProps = {
  ...useButton.props,
  icon: defineProp<LucideIcon>({ required: true }),
  tone: defineProp<'blue' | 'quiet' | 'violet'>({ required: true }),
};
</script>

<script lang="ts" setup>
defineProps(RowSwipeTileProps);
defineEmits(useButton.emits);
defineSlots<{
  /** Its name, under the icon. */
  default(): unknown;
}>();

const { Button } = useButton();
</script>

<template>
  <Button :class="[css.rowSwipeTile, css[`rowSwipeTile_${tone}`]]">
    <component
      :is="icon"
      :class="css.rowSwipeTile_icon"
      aria-hidden="true"
    />
    <span :class="css.rowSwipeTile_label"><slot /></span>
  </Button>
</template>

<style lang="scss" module="css">
.rowSwipeTile {
  @include focus-ring;

  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  align-items: center;
  justify-content: center;
  width: 76px;
  padding: 0 $spacing-4;
  font: inherit;
  font-size: $font-size-md;
  color: $color-on-emphasis;
  cursor: pointer;
  background: var(--row-swipe-tile-fill);
  border: none;

  &:focus-visible {
    outline-offset: -3px;
  }
}

.rowSwipeTile_quiet {
  --row-swipe-tile-fill: #{$color-border-2};
}

.rowSwipeTile_blue {
  --row-swipe-tile-fill: #{$color-blue-emphasis};
}

.rowSwipeTile_violet {
  --row-swipe-tile-fill: #{$color-purple-emphasis};
}

.rowSwipeTile_icon {
  flex: none;
  width: $phone-row-icon-size;
  height: $phone-row-icon-size;
}

.rowSwipeTile_label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
