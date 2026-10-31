<!-- githq's logo, the wordmark "git/hq" (brandbook "Logo — git/hq" in `githq.pen`): Geist 700, violet on the slash alone. `md` heads the first sign-in's steps, `lg` the sign-in page. -->
<script lang="ts" setup>
withDefaults(
  defineProps<{
    size?: 'md' | 'lg';
  }>(),
  { size: 'md' },
);
</script>

<template>
  <span
    :class="[css.wordmark, size === 'lg' && css.wordmark_lg]"
    role="img"
    aria-label="githq"
    >git<span :class="css.wordmark_slash">/</span>hq</span
  >
</template>

<style lang="scss" module="css">
.wordmark {
  font-family: $font-family-brand;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
  color: $color-fg;
  white-space: nowrap;
}

.wordmark_lg {
  font-size: 34px;
}

.wordmark_slash {
  color: $color-accent;
}
</style>
