<!-- A list's display options (D9): "Display" on the toolbar, bordered like the toolbar's other controls — an icon alone when the toolbar is short of room (`iconOnly`, its name kept for screen readers and as its tooltip) — opening the view options the toolbar has no room for (a phone has its own sheet, `ListOptionsSheet`), each a section with its icon and its choices right there, what the list adds, and a footer saying they are kept on this device only, with a reset while they differ from the defaults. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { RotateCcw, SlidersHorizontal } from 'lucide-vue-next';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Popover from '@/components/Popover.vue';

import * as l from './ListDisplayOptions.loc.js';
import ListToolbarControl from './ListToolbarControl.vue';
import type { ListToolbarOption } from './ListToolbarControl.vue';

withDefaults(
  defineProps<{
    /** The view options it holds. */
    options: readonly ListToolbarOption[];
    /** The options differ from the list's defaults: it offers to reset them. */
    modified?: boolean;
    /** The trigger without its label: the icon, named "Display" for screen readers and in its tooltip. */
    iconOnly?: boolean;
  }>(),
  { modified: false, iconOnly: false },
);

const emit = defineEmits<{
  /** Back to the list's defaults. */
  reset: [];
}>();

defineSlots<{
  /** At the top: what the options are changed from (a project's saved view). */
  header?(): unknown;
  /** After the options (why the board is unavailable). */
  default?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <Popover
    :label="t(l.display)"
    align="end"
    flush
  >
    <template #trigger>
      <IconButton
        v-if="iconOnly"
        :class="css.listDisplayOptions_icon"
        :icon="SlidersHorizontal"
        :label="t(l.display)"
      />
      <Button
        v-else
        variant="outline"
        size="sm"
        :icon="SlidersHorizontal"
      >
        {{ t(l.display) }}
      </Button>
    </template>
    <div :class="css.listDisplayOptions">
      <slot name="header" />
      <ListToolbarControl
        v-for="option in options"
        :key="option.key"
        :option="option"
        place="display"
      />
      <slot />
      <div :class="css.listDisplayOptions_footer">
        <span>{{ t(l.deviceOnly) }}</span>
        <Button
          v-if="modified"
          variant="ghost"
          size="sm"
          :icon="RotateCcw"
          @click="emit('reset')"
        >
          {{ t(l.reset) }}
        </Button>
      </div>
    </div>
  </Popover>
</template>

<style lang="scss" module="css">
.listDisplayOptions {
  display: flex;
  flex-direction: column;
  width: 340px;
  max-width: 100%;
}

/* As tall as the toolbar's outlined controls (`Button`'s `sm`), bordered like them. */
.listDisplayOptions_icon {
  --icon-button-width: 26px;
  --icon-button-height: 24px;
  --icon-button-border: 1px solid #{$color-border};
  --icon-button-radius: #{$radius-md};
  --icon-button-glyph-size: 14px;
  --icon-button-hover-background: #{$color-bg-2};
}

/* Under the sections, each closed by its own border. */
.listDisplayOptions_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: $spacing-6 $spacing-8 $spacing-6 14px;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}
</style>
