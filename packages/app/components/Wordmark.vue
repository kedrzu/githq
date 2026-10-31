<!-- githq's name with its mark, at the top left of the screens outside the app's shell (sign-in, the first sign-in's steps). -->
<template>
  <span :class="css.wordmark">
    <span
      :class="css.wordmark_mark"
      aria-hidden="true"
      >hq</span
    >
    githq
  </span>
</template>

<style lang="scss" module="css">
.wordmark {
  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  letter-spacing: -0.2px;
  color: $color-fg;
}

.wordmark_mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-family: $font-family-mono;
  font-size: 10.5px;
  font-weight: 700;
  color: $color-on-light;
  background: $color-accent;
  border-radius: $radius-md;
}
</style>
