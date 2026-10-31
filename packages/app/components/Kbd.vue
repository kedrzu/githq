<!-- A keyboard hint chip ("⌘K", "↵", "A"). Hidden from screen readers: the control it sits on names its shortcut in `aria-keyshortcuts` instead. -->
<script lang="ts" setup>
withDefaults(
  defineProps<{
    /** `onFill`: on a filled button (primary, light) — dark text on a translucent chip. */
    tone?: 'default' | 'onFill';
    /** `sm`: inside a row's meta line ("Open on GitHub O"). */
    size?: 'sm' | 'md';
  }>(),
  { tone: 'default', size: 'md' },
);

defineSlots<{
  /** The keys, as the design writes them ("⌘↵"). */
  default(): unknown;
}>();
</script>

<template>
  <kbd
    :class="[css.kbd, css[`kbd_${tone}`], css[`kbd_${size}`]]"
    aria-hidden="true"
    ><slot
  /></kbd>
</template>

<style lang="scss" module="css">
.kbd {
  display: inline-flex;
  flex: none;
  align-items: center;
  font-family: $font-family-mono;
  font-weight: $font-weight-normal;
  line-height: 1.4;
  white-space: nowrap;
  border: 1px solid;
  border-radius: $radius-sm;
}

.kbd_md {
  padding: 1px 5px;
  font-size: 10.5px;
}

.kbd_sm {
  padding: 0 4px;
  font-size: 10px;
}

.kbd_default {
  color: $color-fg-2;
  background: $color-bg-3;
  border-color: $color-border-2;
}

.kbd_onFill {
  color: $color-on-light;
  background: rgba($color-on-light, 0.1);
  border-color: rgba($color-on-light, 0.2);
}
</style>
