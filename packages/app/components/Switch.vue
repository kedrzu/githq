<!-- An on/off that applies at once (reka-ui's `Switch`): the view options of a code review. Space or a click flips it; wrap it in a `label` with its text, or give it `label`. -->
<script lang="ts" setup>
import { SwitchRoot, SwitchThumb } from 'reka-ui';

defineProps<{
  /** Its accessible name. */
  label: string;
}>();

const model = defineModel<boolean>({ required: true });
</script>

<template>
  <SwitchRoot
    v-model="model"
    :class="css.switch"
    :aria-label="label"
  >
    <SwitchThumb :class="css.switch_thumb" />
  </SwitchRoot>
</template>

<style lang="scss" module="css">
.switch {
  @include focus-ring;

  position: relative;
  flex: none;
  width: 28px;
  height: 16px;
  padding: 0;
  cursor: pointer;
  background: $color-border-2;
  border: 0;
  border-radius: $radius-lg;
  transition: background-color 0.12s;

  &[data-state='checked'] {
    background: $color-accent;
  }
}

.switch_thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  display: block;
  width: 12px;
  height: 12px;
  background: $color-fg;
  border-radius: 50%;
  transition: transform 0.12s;

  &[data-state='checked'] {
    transform: translateX(12px);
  }
}
</style>
