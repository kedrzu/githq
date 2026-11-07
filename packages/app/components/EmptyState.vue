<!-- A list with nothing in it, said calmly (K4, K5; first run and loading D8, `Empty / Note · screen | group | column`): on a screen an icon — grey, green when empty is good news, amber when it can't be read — a title, what was checked so "empty" can be trusted, and optionally a way on; in a list's group one quiet line under its header; in a board column a small centred note. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    /** Optional only in a group or a column, where a plain "Nothing here." has none. */
    icon?: LucideIcon;
    /**
     * `muted`: just nothing here, or filtered out (the design's one quiet grey); `good`: nothing left is good news
     * (green icon); `warning`: it can't be read (amber, as the status bar's stale states).
     */
    tone?: 'good' | 'muted' | 'warning';
    /** In a group or a column, the one line it says. */
    title: string;
    /** Drawn on a screen only. */
    detail?: string;
    /** `screen`: the centred note filling a screen; `group`: a line under a list's group header; `column`: a board column's. */
    place?: 'screen' | 'group' | 'column';
  }>(),
  { icon: undefined, tone: 'muted', detail: undefined, place: 'screen' },
);

defineSlots<{
  /** A way on: a `Button` to where there is something. */
  action?(): unknown;
}>();
</script>

<template>
  <div
    v-if="place === 'screen'"
    :class="css.emptyState"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="[css.emptyState_icon, css[`emptyState_icon_${tone}`]]"
      aria-hidden="true"
    />
    <h2 :class="css.emptyState_title">{{ title }}</h2>
    <p
      v-if="detail"
      :class="css.emptyState_detail"
    >
      {{ detail }}
    </p>
    <slot name="action" />
  </div>
  <div
    v-else
    :class="css[`emptyState_${place}`]"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="[css[`emptyState_${place}Icon`], css[`emptyState_icon_${tone}`]]"
      aria-hidden="true"
    />
    <p :class="css.emptyState_line">{{ title }}</p>
    <slot name="action" />
  </div>
</template>

<style lang="scss" module="css">
.emptyState {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  justify-content: center;
  padding: $spacing-24 $spacing-16 80px;
  text-align: center;
}

.emptyState_icon {
  width: 26px;
  height: 26px;
}

.emptyState_icon_good {
  color: $color-green;
}

.emptyState_icon_muted {
  color: $color-fg-3;
}

.emptyState_icon_warning {
  color: $color-amber;
}

.emptyState_title {
  font-size: 18px;
  font-weight: $font-weight-semibold;
}

.emptyState_detail {
  max-width: 440px;
  font-size: $font-size-md;
  color: $color-fg-2;
}

// Under a group's header, indented as its rows' titles (`ListView`'s note).
.emptyState_group {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-16 $spacing-10 36px;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.emptyState_groupIcon {
  flex: none;
  width: 13px;
  height: 13px;
}

.emptyState_column {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  align-items: center;
  padding: 22px $spacing-12 $spacing-24;
  font-size: $font-size-xs;
  line-height: 1.45;
  color: $color-fg-dim;
  text-align: center;
}

.emptyState_columnIcon {
  width: 16px;
  height: 16px;
}

.emptyState_line {
  min-width: 0;
}
</style>
