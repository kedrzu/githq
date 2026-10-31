<!-- A short hint on hover or keyboard focus of its trigger (reka-ui's tooltip): what an icon button does and its key, or the whole sentence behind a shortened status. The trigger is the default slot's single element. -->
<script lang="ts" setup>
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';

import Kbd from './Kbd.vue';

withDefaults(
  defineProps<{
    /** The hint; the `content` slot replaces it. */
    text?: string;
    /** The trigger's key, after the text. */
    kbd?: string;
    /** Where it opens; `bottom` when not given. */
    side?: 'bottom' | 'left' | 'right' | 'top';
    /** Never opens. */
    disabled?: boolean;
  }>(),
  { text: undefined, kbd: undefined, side: 'bottom' },
);

defineSlots<{
  /** The trigger: one element, which gets the tooltip's handlers. */
  default(): unknown;
  /** Richer content than `text`. */
  content?(): unknown;
}>();
</script>

<template>
  <TooltipProvider
    :delay-duration="400"
    :skip-delay-duration="300"
  >
    <TooltipRoot :disabled="disabled">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :class="css.tooltip"
          :side="side"
          :side-offset="6"
          :collision-padding="8"
        >
          <slot name="content">{{ text }}</slot>
          <Kbd
            v-if="kbd"
            :keys="kbd"
          />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style lang="scss" module="css">
.tooltip {
  z-index: 30;
  display: flex;
  gap: $spacing-8;
  align-items: center;
  max-width: 320px;
  padding: $spacing-4 $spacing-8;
  font-size: $font-size-xs;
  line-height: 16px;
  color: $color-fg;
  background: $color-bg-3;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;
  box-shadow: 0 4px 12px rgb(0 0 0 / 35%);
}
</style>
