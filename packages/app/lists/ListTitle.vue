<!-- The title of a screen's header, opening a menu of what can be done with it when given one (`menu`). An icon (`icon`: a repository's visibility, a project's board) stands right before the name, inside the same button (CH72, D12), named when it says something ("private"). `cut`, when its header has no other room left: cut to the room it has, in full in its tooltip. -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';

/** The icon before a title. */
export interface ListTitleIcon {
  readonly icon: LucideIcon;
  /** What it says, read out with the title ("private"); without it the icon is decoration. */
  readonly label?: string;
  /** `accent`: in the accent colour (a project's, D12). */
  readonly tone?: 'accent';
}
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown } from 'lucide-vue-next';
import { computed } from 'vue';

import Menu from '@/components/Menu.vue';

import * as l from './ListTitle.loc.js';

const props = defineProps<{
  title: string;
  /** Cut to the room there is, ending in "…", the whole title its tooltip (the header's last step, `ListToolbar`). */
  cut?: boolean;
  /** Before the name: what the title names (a lock for a private repository, a board for a project). */
  icon?: ListTitleIcon | null;
}>();

defineSlots<{
  /** The entries of the menu the title opens. */
  menu?(): unknown;
}>();

const t = useTranslate();

/** The menu button's name, with what the icon says. */
const menuLabel = computed(() =>
  props.icon?.label
    ? t(l.menuLabelWithDetail, { title: props.title, detail: props.icon.label })
    : t(l.menuLabel, { title: props.title }),
);
</script>

<template>
  <h1 :class="[css.listTitle, cut && css.listTitle_cut]">
    <Menu
      v-if="$slots.menu"
      align="start"
    >
      <template #trigger>
        <button
          type="button"
          :class="css.listTitle_button"
          :aria-label="menuLabel"
        >
          <component
            :is="icon.icon"
            v-if="icon"
            :class="[css.listTitle_icon, icon.tone && css[`listTitle_icon_${icon.tone}`]]"
            aria-hidden="true"
          />
          <span
            :class="css.listTitle_text"
            :title="cut ? title : undefined"
            data-title-text
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
      :class="css.listTitle_plain"
    >
      <component
        :is="icon.icon"
        v-if="icon"
        :class="[css.listTitle_icon, icon.tone && css[`listTitle_icon_${icon.tone}`]]"
        :role="icon.label ? 'img' : undefined"
        :aria-label="icon.label"
        :aria-hidden="icon.label ? undefined : 'true'"
      />
      <span
        :class="css.listTitle_text"
        :title="cut ? title : undefined"
        data-title-text
        >{{ title }}</span
      >
    </span>
  </h1>
</template>

<style lang="scss" module="css">
.listTitle {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

/* The button may not outgrow the header; its negative margin stays visible, so the text is what is cut. */
.listTitle_cut {
  flex: 0 1 auto;
  min-width: 0;

  .listTitle_button,
  .listTitle_plain {
    max-width: 100%;
  }

  .listTitle_text {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* As the opened item's reference opens its menu (M1); icon, name and chevron one clickable unit. */
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

.listTitle_plain {
  display: flex;
  align-items: center;
}

/* 16 px, 10 px before the name (CH72, D12). */
.listTitle_icon {
  flex: none;
  width: 16px;
  height: 16px;
  margin-right: $spacing-4;
  color: $color-fg-2;

  .listTitle_plain & {
    margin-right: $spacing-10;
  }
}

.listTitle_icon_accent {
  color: $color-accent;
}

.listTitle_chevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-dim;
}
</style>
