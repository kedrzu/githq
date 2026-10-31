<!-- A GitHub label as the lists show it: a dot in the label's colour and its name in dim text, in a thin pill — the colour stays a hint, so any label reads on the dark background. -->
<script lang="ts" setup>
defineProps<{
  name: string;
  /** GitHub's hex colour, without "#" ("d73a4a"). */
  color: string;
}>();
</script>

<template>
  <span :class="css.labelPill">
    <span
      :class="css.labelPill_dot"
      :style="{ background: `#${color}` }"
      aria-hidden="true"
    />
    {{ name }}
  </span>
</template>

<style lang="scss" module="css">
.labelPill {
  display: inline-flex;
  flex: none;
  gap: 5px;
  align-items: center;
  padding: 1px 7px;
  font-size: $font-size-2xs;
  line-height: 14px;
  color: $color-fg-2;
  white-space: nowrap;
  border: 1px solid $color-border-2;
  border-radius: 10px;
}

.labelPill_dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
</style>
