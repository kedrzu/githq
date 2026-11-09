<!-- The article's meta line under its title and lead: when the page last changed and how long it takes to read. The Markdown plugin `articleMetaPlugin` (`lib/markdown.ts`) puts it there; `vp-raw` keeps the article's own type off it. -->
<script lang="ts" setup>
import { History, Timer } from 'lucide-vue-next';

import { usePageMeta } from '../pageMeta.js';

const { updated, readingMinutes } = usePageMeta();
</script>

<template>
  <p
    :class="[css.meta, 'vp-raw']"
    tid="docs-article-meta"
  >
    <span
      v-if="updated"
      :class="css.meta_item"
    >
      <History
        :class="css.meta_icon"
        aria-hidden="true"
      />
      <span>Updated <time :datetime="updated.iso">{{ updated.text }}</time></span>
    </span>
    <span
      v-if="readingMinutes"
      :class="css.meta_item"
    >
      <Timer
        :class="css.meta_icon"
        aria-hidden="true"
      />
      <span>{{ readingMinutes }} min read</span>
    </span>
  </p>
</template>

<style lang="scss" module="css">
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-16;
  align-items: center;
  margin: 0 0 $spacing-8;
  font-size: $font-size-md;
  line-height: 20px;
  color: $color-fg-dim;

  @media (width < 960px) {
    gap: $spacing-4 $spacing-6;
  }
}

.meta_item {
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;

  // A phone has no icons: the facts run on with a dot between them (`DOC5`).
  @media (width < 960px) {
    & + &::before {
      content: '·';
    }
  }
}

.meta_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;

  @media (width < 960px) {
    display: none;
  }
}
</style>
