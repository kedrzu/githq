<!-- Above the article's title on a wide page: its section, linked to the section's first page, and the page itself. A phone names the section in the bar under the top bar instead. -->
<script lang="ts" setup>
import { ChevronRight } from 'lucide-vue-next';
import { useData, withBase } from 'vitepress';

import { usePageMeta } from '../pageMeta.js';

const { page } = useData();
const { section } = usePageMeta();
</script>

<template>
  <nav
    v-if="section"
    :class="css.breadcrumb"
    aria-label="Breadcrumb"
  >
    <a
      :class="css.breadcrumb_section"
      :href="withBase(section.pages[0]?.link ?? '/')"
      >{{ section.title }}</a
    >
    <ChevronRight
      :class="css.breadcrumb_separator"
      aria-hidden="true"
    />
    <span aria-current="page">{{ page.title }}</span>
  </nav>
</template>

<style lang="scss" module="css">
.breadcrumb {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  margin-bottom: $spacing-20;
  font-size: $font-size-md;
  line-height: 20px;
  color: $color-fg-dim;

  @media (width < 960px) {
    display: none;
  }
}

.breadcrumb_section {
  @include focus-ring;

  color: $color-accent;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    text-decoration: underline;
  }
}

.breadcrumb_separator {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}
</style>
