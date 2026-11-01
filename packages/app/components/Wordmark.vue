<!-- githq's logo, the wordmark "git/hq" (brandbook "Logo — git/hq" in `githq.pen`): Geist 700, violet on the slash alone. It heads the first sign-in's steps and the landing page; a caller sizes it with `--wordmark-size`. -->
<template>
  <span
    :class="css.wordmark"
    role="img"
    aria-label="githq"
    >git<span :class="css.wordmark_slash">/</span>hq</span
  >
</template>

<style lang="scss" module="css">
.wordmark {
  font-family: $font-family-brand;
  font-size: var(--wordmark-size, 16px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
  color: $color-fg;
  white-space: nowrap;
}

.wordmark_slash {
  color: $color-accent;
}
</style>
