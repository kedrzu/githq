<!-- A stack's icon in its tone (`StackLook`), and the words after it in the same colour when given (the default slot): the state in words (`StackState`) and each pull request inside an expanded stack's card. The icon is decoration — the words, here or beside it, say the same. Its size is `--stack-tone-icon-size` (12px unless the parent sets it). -->
<script lang="ts" setup>
import type { StackLook } from './useStackFacts.js';

defineProps<{
  look: StackLook;
}>();
</script>

<template>
  <span :class="[css.stackTone, css[`stackTone_${look.tone}`]]">
    <component
      :is="look.icon"
      :class="css.stackTone_icon"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>

<style lang="scss" module="css">
.stackTone {
  display: inline-flex;
  align-items: center;
}

.stackTone_icon {
  flex: none;
  width: var(--stack-tone-icon-size, 12px);
  height: var(--stack-tone-icon-size, 12px);
}

.stackTone_danger {
  color: $color-red;
}

.stackTone_warning {
  color: $color-amber;
}

.stackTone_success {
  color: $color-green;
}

.stackTone_done {
  color: $color-purple;
}

.stackTone_muted {
  color: $color-fg-2;
}

.stackTone_dim {
  color: $color-fg-dim;
}
</style>
