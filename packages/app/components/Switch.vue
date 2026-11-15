<!-- An on/off switch (`Switch`, `Switch / on`): a `role="switch"` button bound by `v-model`, named by `label` for screen readers — the visible words sit beside it, in the caller's layout. A click or Space flips it. `size="touch"` draws it larger, for a finger on a phone's settings (mobile MB158). -->
<script lang="ts" setup>
defineProps<{
  /** Its accessible name ("Default branch"). */
  label: string;
  /** Larger, for a finger (a phone's settings). */
  size?: 'touch';
}>();

const on = defineModel<boolean>({ required: true });
</script>

<template>
  <button
    type="button"
    role="switch"
    :class="[css.switch, on && css.switch_on, size === 'touch' && css.switch_touch]"
    :aria-checked="on"
    :aria-label="label"
    @click="on = !on"
  >
    <span :class="css.switch_knob" />
  </button>
</template>

<style lang="scss" module="css">
.switch {
  @include focus-ring;

  display: inline-flex;
  flex: none;
  align-items: center;
  width: 28px;
  height: 16px;
  padding: $spacing-2;
  cursor: pointer;
  background: $color-border-2;
  border: none;
  border-radius: $radius-lg;
}

.switch_knob {
  width: 12px;
  height: 12px;
  background: $color-fg-2;
  border-radius: 50%;

  @include motion {
    transition: transform 0.12s ease;
  }
}

.switch_on {
  background: $color-accent;

  .switch_knob {
    background: $color-button-light;
    transform: translateX(12px);
  }
}

.switch.switch_touch {
  width: 44px;
  height: 26px;
  padding: 3px;
  border-radius: 13px;

  .switch_knob {
    width: 20px;
    height: 20px;
  }

  &.switch_on .switch_knob {
    transform: translateX(18px);
  }
}
</style>
