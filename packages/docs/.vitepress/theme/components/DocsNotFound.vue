<!-- The docs' "not found" page, in the default theme's `not-found` slot. The build writes it to `dist/404.html`, which the app's Worker returns with a 404 for an unknown `/docs/…` address. -->
<script lang="ts" setup>
import { ArrowUpRight, BookOpen } from 'lucide-vue-next';
import { withBase } from 'vitepress';
</script>

<template>
  <div
    :class="css.notFound"
    tid="docs-not-found"
  >
    <p :class="css.notFound_code">404</p>
    <h1 :class="css.notFound_title">This page isn't in the docs</h1>
    <p :class="css.notFound_text">It may have moved, or the address has a typo. Start again from the docs' home.</p>
    <div :class="css.notFound_links">
      <a
        :class="[css.notFound_link, css.notFound_link__primary]"
        :href="withBase('/')"
      >
        <BookOpen
          :class="css.notFound_icon"
          aria-hidden="true"
        />
        Docs home
      </a>
      <!-- Outside the docs' base, with a target: VitePress's router leaves it to the browser (`DocsOpenGithq`). -->
      <a
        :class="css.notFound_link"
        href="/"
        target="_self"
      >
        <ArrowUpRight
          :class="css.notFound_icon"
          aria-hidden="true"
        />
        Open githq
      </a>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.notFound {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  align-items: center;
  padding: 120px $spacing-24 96px;
  text-align: center;

  @media (width < 640px) {
    padding: 72px $spacing-16 64px;
  }
}

.notFound_code {
  margin: 0;
  font-family: $font-family-mono;
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-accent;
  letter-spacing: 1px;
}

.notFound_title {
  margin: 0;
  font-size: 34px;
  font-weight: $font-weight-semibold;
  line-height: 1.2;
  color: $color-fg;
  text-wrap: balance;
  letter-spacing: -0.6px;

  @media (width < 640px) {
    font-size: 26px;
  }
}

.notFound_text {
  max-width: 520px;
  margin: 0;
  font-size: 17px;
  line-height: 1.6;
  color: $color-fg-2;
  text-wrap: balance;
}

.notFound_links {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-12;
  justify-content: center;
  margin-top: $spacing-8;
}

.notFound_link {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  padding: $spacing-8 $spacing-14;
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  line-height: 18px;
  color: $color-fg;
  text-decoration: none;
  white-space: nowrap;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;

  &:hover {
    background: $color-bg-3;
  }
}

.notFound_link__primary {
  color: $color-on-light;
  background: $color-button-light;
  border-color: $color-button-light;

  &:hover {
    background: $color-button-light-hover;
  }
}

.notFound_icon {
  width: 15px;
  height: 15px;
}
</style>
