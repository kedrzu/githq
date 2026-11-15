<!-- A row of Settings on a phone (`Phone / Settings / Row`, mobile MB146–MB161): a finger's height, an optional icon, the label with a line of detail under it, its value at the right in grey (amber or green when it says so) and what the row does at its very end — a chevron where it goes into a screen (`to`, or `action` for a button), ↗ where it opens a page outside the app (`href`), nothing where it only tells. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';
import { ArrowUpRight, ChevronRight } from 'lucide-vue-next';
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { RouterLink } from 'vue-router';

const props = defineProps<{
  label: string;
  icon?: LucideIcon;
  /** A line under the label. */
  detail?: string;
  /** What the row says at its right ("15", "Animations on"). */
  value?: string;
  /** The value's colour: amber where something wants attention, green where it is good news. */
  tone?: 'amber' | 'good';
  /** Where the row goes in the app: a chevron at its end. */
  to?: RouteLocationRaw;
  /** A page outside the app, opened in a new tab: ↗ at its end. */
  href?: string;
  /** A button doing what the caller says (`click`), a chevron at its end. */
  action?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

const tag = computed(() => {
  if (props.to !== undefined) {
    return RouterLink;
  }

  if (props.href !== undefined) {
    return 'a';
  }

  return props.action ? 'button' : 'div';
});
const attrs = computed(() => {
  if (props.to !== undefined) {
    return { to: props.to };
  }

  if (props.href !== undefined) {
    return { href: props.href, target: '_blank', rel: 'noopener noreferrer' };
  }

  return props.action ? { type: 'button' } : {};
});
const interactive = computed(() => props.to !== undefined || props.href !== undefined || props.action);
</script>

<template>
  <component
    :is="tag"
    v-bind="attrs"
    :class="[css.phoneSettingsRow, interactive && css.phoneSettingsRow_interactive]"
    @click="emit('click')"
  >
    <component
      :is="icon"
      v-if="icon"
      :class="css.phoneSettingsRow_icon"
      aria-hidden="true"
    />
    <span :class="css.phoneSettingsRow_text">
      <span :class="css.phoneSettingsRow_label">
        <slot name="label">{{ label }}</slot>
      </span>
      <span
        v-if="detail"
        :class="css.phoneSettingsRow_detail"
        >{{ detail }}</span
      >
    </span>
    <span
      v-if="value"
      :class="[css.phoneSettingsRow_value, tone && css[`phoneSettingsRow_value_${tone}`]]"
      >{{ value }}</span
    >
    <ArrowUpRight
      v-if="href !== undefined"
      :class="css.phoneSettingsRow_end"
      aria-hidden="true"
    />
    <ChevronRight
      v-else-if="interactive"
      :class="css.phoneSettingsRow_end"
      aria-hidden="true"
    />
  </component>
</template>

<style lang="scss" module="css">
.phoneSettingsRow {
  display: flex;
  gap: $spacing-12;
  align-items: center;
  width: 100%;
  min-height: $touch-target-size;
  padding: $spacing-6 $spacing-16;
  font: inherit;
  font-size: $font-size-xl;
  color: $color-fg;
  text-align: start;
  text-decoration: none;
  background: none;
  border: none;
}

.phoneSettingsRow_interactive {
  cursor: pointer;

  &:active {
    background: $color-bg-3;
  }

  &:focus-visible {
    outline: 2px solid $color-focus;
    outline-offset: -2px;
  }
}

.phoneSettingsRow_icon {
  flex: none;
  width: $phone-row-icon-size;
  height: $phone-row-icon-size;
  color: $color-fg-2;
}

.phoneSettingsRow_text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.phoneSettingsRow_label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phoneSettingsRow_detail {
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.phoneSettingsRow_value {
  flex: none;
  max-width: 50%;
  overflow: hidden;
  font-size: $font-size-md;
  color: $color-fg-dim;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phoneSettingsRow_value_amber {
  color: $color-amber;
}

.phoneSettingsRow_value_good {
  color: $color-green;
}

.phoneSettingsRow_end {
  flex: none;
  width: 16px;
  height: 16px;
  color: $color-fg-3;
}
</style>
