<!-- One property of an item — "Assignees", "Labels", a project's "Status" — as a row of a definition list (`<dl>`): its name, its value, and the key that edits it drawn at the end. Put it inside a `<dl>`. -->
<script lang="ts" setup>
import Kbd from './Kbd.vue';

withDefaults(
  defineProps<{
    label: string;
    /** The key that edits it ("A"); only drawn — the caller handles the key. */
    kbd?: string;
    /** `card`: inside a project's card — a narrower name column and smaller names. */
    size?: 'card' | 'md';
  }>(),
  { kbd: undefined, size: 'md' },
);

defineSlots<{
  /** The value. */
  default(): unknown;
}>();
</script>

<template>
  <div :class="[css.propertyRow, css[`propertyRow_${size}`]]">
    <dt :class="css.propertyRow_label">{{ label }}</dt>
    <dd :class="css.propertyRow_value">
      <slot />
      <Kbd
        v-if="kbd"
        :class="css.propertyRow_kbd"
        :keys="kbd"
      />
    </dd>
  </div>
</template>

<style lang="scss" module="css">
.propertyRow {
  display: flex;
  gap: $spacing-8;
  align-items: flex-start;
  min-height: 18px;
}

.propertyRow_label {
  flex: none;
  padding-top: 1px;
  line-height: 16px;
  color: $color-fg-dim;

  .propertyRow_md & {
    width: 92px;
    font-size: $font-size-sm;
  }

  .propertyRow_card & {
    width: 80px;
    font-size: $font-size-xs;
  }
}

.propertyRow_value {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: $spacing-6 $spacing-8;
  align-items: center;
  min-width: 0;
  margin: 0;
  font-size: $font-size-sm;
  line-height: 18px;
  color: $color-fg;
}

.propertyRow_kbd {
  margin-left: auto;
}
</style>
