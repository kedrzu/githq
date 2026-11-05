<!-- The head of a `bare` dialog (CR29, CR39, CR75): its title and the Esc that closes it. The dialog's own title is what a screen reader hears, so this one is hidden from it. -->
<script lang="ts" setup>
import Kbd from './Kbd.vue';

defineProps<{
  title: string;
}>();
</script>

<template>
  <header :class="css.dialogHead">
    <span
      :class="css.dialogHead_title"
      aria-hidden="true"
      >{{ title }}</span
    >
    <Kbd keys="Escape" />
  </header>
</template>

<style lang="scss" module="css">
.dialogHead {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-14 $spacing-16;
  border-bottom: 1px solid $color-border;
}

.dialogHead_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}
</style>
