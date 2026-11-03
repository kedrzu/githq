<!-- The title of a screen's header, opening a menu of what can be done with it when given one (`menu`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown } from 'lucide-vue-next';

import Menu from '@/components/Menu.vue';

import * as l from './ListTitle.loc.js';

defineProps<{
  title: string;
}>();

defineSlots<{
  /** The entries of the menu the title opens. */
  menu?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <h1 :class="css.listTitle">
    <Menu
      v-if="$slots.menu"
      align="start"
    >
      <template #trigger>
        <button
          type="button"
          :class="css.listTitle_button"
          :aria-label="t(l.menuLabel, { title })"
        >
          {{ title }}
          <ChevronDown
            :class="css.listTitle_chevron"
            aria-hidden="true"
          />
        </button>
      </template>
      <slot name="menu" />
    </Menu>
    <template v-else>{{ title }}</template>
  </h1>
</template>

<style lang="scss" module="css">
.listTitle {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

/* As the opened item's reference opens its menu (M1). */
.listTitle_button {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  height: 26px;
  padding: 0 $spacing-6;
  margin-left: -$spacing-6;
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-md;

  &:hover,
  &[data-state='open'] {
    background: $color-bg-3;
  }
}

.listTitle_chevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}
</style>
