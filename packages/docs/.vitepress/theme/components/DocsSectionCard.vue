<!-- A section's card on the home page (`Docs / Section card`): its icon, title and description, and its first three pages. Everything in it comes from the section in `sections.ts`, as the sidebar does. -->
<script lang="ts" setup>
import { withBase } from 'vitepress';
import { computed } from 'vue';

import type { DocsSection } from '../../sections.js';
import { sectionIcons } from '../sectionIcons.js';

const props = defineProps<{ section: DocsSection }>();

/** The pages the card links to: the section's first three, in reading order. */
const PAGES_SHOWN = 3;

const icon = computed(() => sectionIcons[props.section.icon]);
const pages = computed(() => props.section.pages.slice(0, PAGES_SHOWN));
</script>

<template>
  <section
    :class="css.card"
    :aria-labelledby="`docs-section-${section.id}`"
    tid="docs-section-card"
  >
    <span :class="css.card_iconBox">
      <component
        :is="icon"
        :class="css.card_icon"
        aria-hidden="true"
      />
    </span>
    <div :class="css.card_text">
      <h2
        :id="`docs-section-${section.id}`"
        :class="css.card_title"
      >
        {{ section.title }}
      </h2>
      <p :class="css.card_description">{{ section.description }}</p>
    </div>
    <ul :class="css.card_pages">
      <li
        v-for="page in pages"
        :key="page.link"
      >
        <a
          :class="css.card_page"
          :href="withBase(page.link)"
          >{{ page.title }}</a
        >
      </li>
    </ul>
  </section>
</template>

<style lang="scss" module="css">
.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: $spacing-24;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}

.card_iconBox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba($color-accent, 0.12);
  border-radius: $radius-lg;
}

.card_icon {
  width: 16px;
  height: 16px;
  color: $color-accent;
}

.card_text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-6;
}

.card_title {
  margin: 0;
  font-size: 17px;
  font-weight: $font-weight-semibold;
  line-height: 1.4;
  color: $color-fg;
}

.card_description {
  margin: 0;
  font-size: $font-size-lg;
  line-height: 1.55;
  color: $color-fg-2;
}

.card_pages {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  padding: $spacing-12 0 0;
  margin: 0;
  font-size: $font-size-row-title;
  line-height: 16px;
  list-style: none;
  border-top: 1px solid $color-border;
}

.card_page {
  @include focus-ring;

  color: $color-accent;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    text-decoration: underline;
  }
}
</style>
