<!-- A boolean setting on a phone (`Phone / Settings / Switch row`, mobile MB158, MB160, MB240): its label with what it does under it, and a finger-sized `Switch` at the right, named by the label and described by the text. The whole row is the Switch's hit area (its stretched `::after`), so a tap anywhere on it flips it; keyboard focus on the Switch rings the row. -->
<script lang="ts" setup>
import { useId } from 'vue';

import Switch from '@/components/Switch.vue';

defineProps<{
  label: string;
  /** What the setting does: the Switch's description too. */
  description?: string;
}>();

const on = defineModel<boolean>({ required: true });

const id = useId();
</script>

<template>
  <div :class="css.phoneSettingsSwitchRow">
    <div :class="css.phoneSettingsSwitchRow_text">
      <span :class="css.phoneSettingsSwitchRow_label">{{ label }}</span>
      <span
        v-if="description"
        :id="`${id}-description`"
        :class="css.phoneSettingsSwitchRow_description"
        >{{ description }}</span
      >
    </div>
    <Switch
      v-model="on"
      size="touch"
      :label="label"
      :aria-describedby="description ? `${id}-description` : undefined"
      :class="css.phoneSettingsSwitchRow_switch"
    />
  </div>
</template>

<style lang="scss" module="css">
.phoneSettingsSwitchRow {
  position: relative;
  display: flex;
  gap: $spacing-16;
  align-items: center;
  min-height: $touch-target-size;
  padding: $spacing-8 $spacing-16;

  &:active {
    background: $color-bg-3;
  }

  &:has(.phoneSettingsSwitchRow_switch:focus-visible) {
    @include focus-outline(-2px);
  }
}

.phoneSettingsSwitchRow_text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-2;
  min-width: 0;
}

.phoneSettingsSwitchRow_label {
  font-size: $font-size-xl;
  color: $color-fg;
}

.phoneSettingsSwitchRow_description {
  font-size: $font-size-md;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.phoneSettingsSwitchRow .phoneSettingsSwitchRow_switch {
  &::after {
    position: absolute;
    inset: 0;
    content: '';
  }

  &:focus-visible {
    outline: none;
  }
}
</style>
