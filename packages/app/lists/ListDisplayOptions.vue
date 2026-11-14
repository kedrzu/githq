<!-- A list's display options (D9): a button — "Display" on the toolbar, an icon alone in the phone's top bar (mobile MB32) — opening the view options the toolbar has no room for (every one on a phone), each a section with its icon and its choices right there, what the list adds, and a footer saying they are kept on this device only, with a reset while they differ from the defaults. -->
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
    /** The trigger an icon alone, sized by the bar it sits in (the phone's top bar). */
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
        :icon="SlidersHorizontal"
        :label="t(l.display)"
      />
      <Button
        v-else
        variant="ghost"
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
