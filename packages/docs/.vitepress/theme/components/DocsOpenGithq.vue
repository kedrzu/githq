<!-- "Open githq" at the end of the top bar on a wide page. A plain anchor outside the docs' base with a target, so VitePress's router leaves it alone (`router.ts` skips a link with `target`): the app is another site, loaded in full. -->
<script lang="ts" setup>
import { ArrowUpRight } from 'lucide-vue-next';
</script>

<template>
  <a
    :class="css.open"
    href="/"
    target="_self"
    tid="docs-open-githq"
  >
    <ArrowUpRight
      :class="css.open_icon"
      aria-hidden="true"
    />
    Open githq
  </a>
</template>

<style lang="scss" module="css">
.open {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  padding: $spacing-8 $spacing-14;
  margin-left: $spacing-6;
  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  line-height: 18px;
  color: $color-on-light;
  text-decoration: none;
  white-space: nowrap;
  background: $color-button-light;
  border-radius: $radius-lg;

  &:hover {
    background: $color-button-light-hover;
  }

  @media (width < 960px) {
    display: none;
  }
}

.open_icon {
  width: 15px;
  height: 15px;
}
</style>
