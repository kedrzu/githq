<!-- The top bar's brand: githq's wordmark "git/hq" (as the app's `Wordmark`) and "docs". The default theme's title link around it leads to the docs' first page (`/docs/`). -->
<template>
  <span :class="css.brand">
    <span
      :class="css.brand_wordmark"
      role="img"
      aria-label="githq"
      >git<span :class="css.brand_slash">/</span>hq</span
    >
    <span :class="css.brand_docs">docs</span>
  </span>
</template>

<style lang="scss" module="css">
.brand {
  display: inline-flex;
  gap: $spacing-10;
  align-items: baseline;

  @media (width < 960px) {
    gap: $spacing-8;
  }
}

.brand_wordmark {
  font-family: $font-family-brand;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
  color: $color-fg;
  white-space: nowrap;
}

.brand_slash {
  color: $color-accent;
}

.brand_docs {
  font-family: $font-family-sans;
  font-size: 16px;
  font-weight: $font-weight-medium;
  line-height: 1;
  color: $color-fg-2;

  @media (width < 960px) {
    font-size: $font-size-xl;
  }
}
</style>
