<!-- A number set a step at a time (`Settings / Stepper`): its label above, then − / the value with its unit dim / +. Each button is named and stays focusable at the end of the range, announced as unavailable (`aria-disabled`), so the focus is not lost on the last press; the value is an `output` that announces each change. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Minus, Plus } from 'lucide-vue-next';
import { useId } from 'vue';

import IconButton from '@/components/IconButton.vue';
import type { TypographyRange } from '@/typography/typographyCatalog.js';

import * as l from './SettingsStepper.loc.js';

const props = defineProps<{
  /** What it sets ("Size"): shown above it and the group's name. */
  label: string;
  /** Where the value may go and by how much a press moves it. */
  range: TypographyRange;
  /** Dim after the value ("px"). */
  unit?: string;
}>();

const value = defineModel<number>({ required: true });

const t = useTranslate();
const labelId = useId();

function step(direction: -1 | 1) {
  if (canStep(direction)) {
    value.value = stepped(direction);
  }
}

function canStep(direction: -1 | 1) {
  const next = stepped(direction);
  return next >= props.range.min && next <= props.range.max;
}

/** The value a press moves to, without the float noise of the step's arithmetic (1.95 + 0.05); no step is finer than a hundredth. */
function stepped(direction: -1 | 1) {
  return Number((value.value + direction * props.range.step).toFixed(2));
}
</script>

<template>
  <div
    :class="css.settingsStepper"
    role="group"
    :aria-labelledby="labelId"
  >
    <span
      :id="labelId"
      :class="css.settingsStepper_label"
      >{{ label }}</span
    >
    <div :class="css.settingsStepper_control">
      <IconButton
        :class="css.settingsStepper_button"
        :icon="Minus"
        :label="t(l.decrease)"
        :unavailable="!canStep(-1)"
        @click="step(-1)"
      />
      <output
        :class="css.settingsStepper_value"
        aria-live="polite"
      >
        {{ value }}
        <span
          v-if="unit"
          :class="css.settingsStepper_unit"
          >{{ unit }}</span
        >
      </output>
      <IconButton
        :class="css.settingsStepper_button"
        :icon="Plus"
        :label="t(l.increase)"
        :unavailable="!canStep(1)"
        @click="step(1)"
      />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.settingsStepper {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.settingsStepper_label {
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.settingsStepper_control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100px;
  height: 32px;
  padding: 0 $spacing-4;
  border: 1px solid $color-border-2;
  border-radius: $radius-md;
}

.settingsStepper_button[aria-disabled='true'] {
  --icon-button-color: #{$color-fg-3};
}

.settingsStepper_value {
  font-size: $font-size-md;
  font-variant-numeric: tabular-nums;
  color: $color-fg;
  white-space: nowrap;
}

.settingsStepper_unit {
  color: $color-fg-dim;
}
</style>
