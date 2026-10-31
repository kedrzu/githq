<!-- The steps of a path through several screens ("Sign in → Choose what to track → First download"): the ones done ticked, the current one numbered in the accent, the ones to come numbered and dim. -->
<script lang="ts" setup>
import { Check } from 'lucide-vue-next';

defineProps<{
  /** The steps' names, in order. */
  steps: readonly string[];
  /** The index of the step the user is on. */
  current: number;
  /** The list's accessible name ("Getting started"). */
  label: string;
}>();
</script>

<template>
  <ol
    :class="css.stepper"
    :aria-label="label"
  >
    <li
      v-for="(step, index) in steps"
      :key="step"
      :class="[
        css.stepper_step,
        index < current && css.stepper_step_done,
        index === current && css.stepper_step_current,
      ]"
      :aria-current="index === current ? 'step' : undefined"
    >
      <span
        v-if="index > 0"
        :class="css.stepper_line"
        aria-hidden="true"
      />
      <span
        :class="css.stepper_num"
        aria-hidden="true"
      >
        <Check
          v-if="index < current"
          :class="css.stepper_check"
        />
        <template v-else>{{ index + 1 }}</template>
      </span>
      {{ step }}
    </li>
  </ol>
</template>

<style lang="scss" module="css">
.stepper {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 0;
  margin: 0;
  list-style: none;
}

.stepper_step {
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: $font-size-sm;
  line-height: 18px;
  color: $color-fg-dim;
  white-space: nowrap;
}

.stepper_step_current {
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.stepper_line {
  width: 24px;
  height: 1px;
  margin-right: 11px;
  background: $color-border-2;
}

.stepper_num {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 10.5px;
  font-weight: $font-weight-semibold;
  color: $color-fg-dim;
  background: $color-bg-3;
  border-radius: 50%;

  .stepper_step_current & {
    color: $color-on-light;
    background: $color-accent;
  }

  .stepper_step_done & {
    color: $color-green;
    background: rgba($color-green, 0.15);
  }
}

.stepper_check {
  width: 11px;
  height: 11px;
  stroke-width: 3;
}
</style>
