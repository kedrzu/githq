<!-- The docs' home page (`DOC1`): the hero with its search, a card for each section of `sections.ts` (the sidebar's own list, so the two can't differ), the pages changed last and the site's footer. `src/index.md` holds its words in `home:`. -->
<script lang="ts" setup>
import { Search } from 'lucide-vue-next';
import { useData } from 'vitepress';
import { computed } from 'vue';

import { sections } from '../../sections.js';
import { openSearch } from '../search.js';
import DocsRecentlyUpdated from './DocsRecentlyUpdated.vue';
import DocsSectionCard from './DocsSectionCard.vue';
import DocsSiteFooter from './DocsSiteFooter.vue';

const { frontmatter } = useData();

const home = computed(() => {
  const value: unknown = frontmatter.value.home;
  const words = typeof value === 'object' && value !== null ? value : {};
  return {
    tag: text(words, 'tag'),
    title: text(words, 'title'),
    lead: text(words, 'lead'),
    search: text(words, 'search') || 'Search the docs',
  };
});

function text(words: object, key: string): string {
  const value: unknown = Reflect.get(words, key);
  return typeof value === 'string' ? value : '';
}
</script>

<template>
  <div :class="css.home">
    <header :class="css.hero">
      <p
        v-if="home.tag"
        :class="css.hero_tag"
      >
        {{ home.tag }}
      </p>
      <h1 :class="css.hero_title">{{ home.title }}</h1>
      <p
        v-if="home.lead"
        :class="css.hero_lead"
      >
        {{ home.lead }}
      </p>
      <button
        :class="css.hero_search"
        type="button"
        tid="docs-home-search"
        @click="openSearch"
      >
        <Search
          :class="css.hero_searchIcon"
          aria-hidden="true"
        />
        <span :class="css.hero_searchPlaceholder">{{ home.search }}</span>
        <span
          :class="css.hero_searchKeys"
          aria-hidden="true"
        >
          <kbd :class="css.hero_searchMod" /><kbd>K</kbd>
        </span>
      </button>
    </header>

    <div :class="css.home_body">
      <div :class="css.sections">
        <DocsSectionCard
          v-for="section in sections"
          :key="section.id"
          :section="section"
        />
      </div>

      <DocsRecentlyUpdated :class="css.home_recent" />
    </div>

    <DocsSiteFooter />
  </div>
</template>

<style lang="scss" module="css">
.home {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--vp-nav-height));
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: center;
  padding: 88px $spacing-24 56px;
  text-align: center;

  @media (width < 640px) {
    gap: 14px;
    padding: 48px $spacing-16 40px;
  }
}

.hero_tag {
  margin: 0;
  font-family: $font-family-mono;
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-accent;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.hero_title {
  max-width: 900px;
  margin: 0;
  font-size: 44px;
  font-weight: $font-weight-semibold;
  line-height: 1.15;
  color: $color-fg;
  text-wrap: balance;
  letter-spacing: -1px;

  @media (width < 640px) {
    font-size: 30px;
    letter-spacing: -0.6px;
  }
}

.hero_lead {
  max-width: 800px;
  margin: 0;
  font-size: 18px;
  line-height: 1.5;
  color: $color-fg-2;
  text-wrap: balance;

  @media (width < 640px) {
    font-size: 16px;
  }
}

// The search field (`Docs / Search field`), 560 wide: it opens the search, as ⌘K does.
.hero_search {
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: min(560px, 100%);
  padding: 7px $spacing-8 7px $spacing-10;
  margin-top: 14px;
  font-size: $font-size-lg;
  line-height: 20px;
  color: $color-fg-dim;
  text-align: left;
  cursor: text;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &:hover {
    color: $color-fg-2;
    border-color: $color-border-2;
  }
}

.hero_searchIcon {
  flex: none;
  width: 15px;
  height: 15px;
}

.hero_searchPlaceholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero_searchKeys {
  display: flex;
  flex: none;
  gap: 3px;

  // A phone has no keyboard to press them on.
  @media (width < 640px) {
    display: none;
  }
}

// The modifier as the default theme's search button writes it: "⌘" on a Mac (its `mac` class on `html`), "Ctrl" elsewhere.
.hero_searchMod::after {
  content: 'Ctrl';
}

:global(.mac) .hero_searchMod::after {
  content: '⌘';
}

// The cards and "Recently updated": 1120 wide, as the design's 160 either side of a 1440 page.
// A flex item: auto margins would shrink it to its content, so it takes the width and caps it.
.home_body {
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px + 2 * $spacing-24;
  padding: 0 $spacing-24;
  margin: 0 auto;

  @media (width < 640px) {
    padding: 0 $spacing-16;
  }
}

.sections {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $spacing-20;

  @media (width < 640px) {
    grid-template-columns: 1fr;
    gap: $spacing-12;
  }
}

.home_recent {
  padding: 56px 0 72px;

  @media (width < 640px) {
    padding: 40px 0 48px;
  }
}
</style>
