<!-- "Recently updated" on the home page: the five pages of the sidebar whose files changed last, by git (`recentlyUpdated.data.ts`), each with its section and date. -->
<script lang="ts" setup>
import { ArrowRight } from 'lucide-vue-next';
import { withBase } from 'vitepress';

import { DOCS_HISTORY_URL } from '../../links.js';
import { formatDate } from '../pageMeta.js';
import { data as pages } from '../recentlyUpdated.data.js';
</script>

<template>
  <section
    v-if="pages.length"
    :class="css.recent"
    aria-labelledby="docs-recently-updated"
    tid="docs-recently-updated"
  >
    <div :class="css.recent_head">
      <h2
        id="docs-recently-updated"
        :class="css.recent_title"
      >
        Recently updated
      </h2>
      <a
        :class="css.recent_history"
        :href="DOCS_HISTORY_URL"
        target="_blank"
        rel="noopener noreferrer"
        >Docs history on GitHub<ArrowRight
          :class="css.recent_historyIcon"
          aria-hidden="true"
      /></a>
    </div>
    <ul :class="css.recent_list">
      <li
        v-for="page in pages"
        :key="page.link"
        :class="css.recent_row"
      >
        <span :class="css.recent_page">
          <a
            :class="css.recent_link"
            :href="withBase(page.link)"
            >{{ page.title }}</a
          >
          <span :class="css.recent_section">{{ page.section }}</span>
        </span>
        <time
          :class="css.recent_date"
          :datetime="formatDate(page.updated).iso"
          >{{ formatDate(page.updated).text }}</time
        >
      </li>
    </ul>
  </section>
</template>

<style lang="scss" module="css">
.recent {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.recent_head {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8 $spacing-16;
  align-items: center;
  justify-content: space-between;
}

.recent_title {
  margin: 0;
  font-size: 17px;
  font-weight: $font-weight-semibold;
  line-height: 1.4;
  color: $color-fg;
}

.recent_history {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-4;
  align-items: center;
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-accent;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    text-decoration: underline;
  }
}

.recent_historyIcon {
  width: 13px;
  height: 13px;
}

.recent_list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.recent_row {
  display: flex;
  gap: $spacing-4 $spacing-16;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-12 0;
  border-bottom: 1px solid $color-border;

  @media (width < 640px) {
    flex-direction: column;
    align-items: flex-start;
  }
}

.recent_page {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2 $spacing-10;
  align-items: baseline;
  min-width: 0;
}

.recent_link {
  @include focus-ring;

  font-size: $font-size-lg;
  font-weight: $font-weight-medium;
  line-height: 20px;
  color: $color-fg;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-accent;
  }
}

.recent_section,
.recent_date {
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-fg-dim;
}

.recent_date {
  flex: none;
}
</style>
