<!-- The title of a screen's header, opening a menu of what can be done with it when given one (`menu`). `narrow`, for a column's head: under the screen's own title, smaller and cut to the room it has. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown } from 'lucide-vue-next';

import Menu from '@/components/Menu.vue';

import * as l from './ListTitle.loc.js';

defineProps<{
  title: string;
  /** In a column's head: a heading under the screen's own, cut to the room there is. */
  narrow?: boolean;
}>();

defineSlots<{
  /** The entries of the menu the title opens. */
  menu?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <component
    :is="narrow ? 'h2' : 'h1'"
    :class="[css.listTitle, narrow && css.listTitle_narrow]"
  >
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
          <span
            :class="css.listTitle_text"
            :title="narrow ? title : undefined"
            >{{ title }}</span
          >
          <ChevronDown
            :class="css.listTitle_chevron"
            aria-hidden="true"
          />
        </button>
      </template>
      <slot name="menu" />
    </Menu>
    <span
      v-else
      :class="css.listTitle_text"
      :title="narrow ? title : undefined"
      >{{ title }}</span
    >
  </component>
</template>

<style lang="scss" module="css">
.listTitle {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

/* The button may not outgrow the column; its negative margin stays visible, so the text is what is cut. */
.listTitle_narrow {
  flex: 1;
  min-width: 0;
  font-size: $font-size-md;

  .listTitle_button {
    max-width: 100%;
  }

  .listTitle_text {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
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
