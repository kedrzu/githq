<!-- What sits among a diff's lines, a thread or a comment box: on its own half in split with the line between the halves going on beside it, indented to the code in unified (D24), or from the file's left edge; never wider than reads well. -->
<script lang="ts" setup>
defineProps<{
  /** `null` for the file's width. */
  inline: 'left' | 'right' | 'unified' | null;
}>();
</script>

<template>
  <div :class="[css.reviewRowInset, inline && css[`reviewRowInset_${inline}`]]">
    <div :class="css.reviewRowInset_content">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" module="css">
.reviewRowInset {
  padding: $spacing-8 $spacing-14;
  background: $color-bg;
}

.reviewRowInset_content {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  // A readable measure for the comments' text on a wide screen (D24).
  max-width: 760px;
}

.reviewRowInset_left {
  width: 50%;
  padding-right: $spacing-6;
  padding-left: $spacing-6;
}

.reviewRowInset_right {
  padding-right: $spacing-6;
  padding-left: calc(50% + #{$spacing-6});
  background:
    linear-gradient($color-border, $color-border) 50% 0 / 1px 100% no-repeat,
    $color-bg;
}

// Indented to the code: two numbers and the sign.
.reviewRowInset_unified {
  padding-right: $spacing-14;
  padding-left: 108px;
}
</style>
