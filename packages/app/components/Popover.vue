<!-- A floating panel anchored to its trigger (reka-ui's `Popover`): the pickers of an item's properties sit in one. Opens on the trigger, closes on Escape or a click outside and gives focus back to the trigger. -->
<script lang="ts" setup>
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';

withDefaults(
  defineProps<{
    /** The panel's accessible name ("Labels"), whatever its trigger says; it is a dialog. */
    label: string;
    /** Along the trigger's edge; `start` when not given. */
    align?: 'center' | 'end' | 'start';
    /** Where it opens; `bottom` when not given. */
    side?: 'bottom' | 'left' | 'right' | 'top';
    /** No padding of its own: the panel's sections run to its edges (the display options). */
    flush?: boolean;
  }>(),
  { align: 'start', side: 'bottom', flush: false },
);

defineSlots<{
  /** The trigger: one button, which gets the popover's handlers and ARIA. */
  trigger(): unknown;
  /** The panel. */
  default(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });

/**
 * reka names the panel by its trigger with `aria-labelledby`, which beats `aria-label`, and no prop or attribute reaches
 * it. The event comes from the wrapper it positions the panel with.
 */
function nameByLabel(event: Event) {
  if (event.target instanceof Element) {
    event.target.querySelector('[role="dialog"]')?.removeAttribute('aria-labelledby');
  }
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :class="[css.popover, flush && css.popover_flush]"
        :aria-label="label"
        :align="align"
        :side="side"
        :side-offset="4"
        :collision-padding="8"
        @open-auto-focus="nameByLabel"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" module="css">
.popover {
  z-index: 20;
  min-width: 220px;
  max-width: 360px;
  padding: $spacing-8;
  font-size: $font-size-md;
  color: $color-fg;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
  outline: none;
  box-shadow: $shadow-popover;
}

.popover_flush {
  padding: 0;
  overflow: hidden;
}
</style>
