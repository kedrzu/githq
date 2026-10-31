<!-- A list with nothing in it, said calmly (K4, K5): an icon — green when empty is good news — a title, what was checked so "empty" can be trusted, and optionally a way on. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    icon: LucideIcon;
    /** `good`: nothing left is good news (green icon); `calm`: just nothing here (grey). */
    tone?: 'calm' | 'good';
    title: string;
    detail?: string;
  }>(),
  { tone: 'calm', detail: undefined },
);

defineSlots<{
  /** A way on: a `Button` to where there is something. */
  action?(): unknown;
}>();
</script>

<template>
  <div :class="css.emptyState">
    <component
      :is="icon"
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

.emptyState_icon_calm {
  color: $color-fg-2;
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
</style>
