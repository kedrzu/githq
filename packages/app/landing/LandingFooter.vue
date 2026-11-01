<!-- The landing page's footer (githq.pen "Landing — githq.dev", Footer): the wordmark and tagline, links to the page's sections and "Sign in", to the project on GitHub and to how githq works, the legal line and the repository and its release feed. "Sign in" emits `signIn`. -->
<script lang="ts" setup>
import type { Translation } from '@nzyme/i18n-core';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Github, Rss } from 'lucide-vue-next';
import { useId } from 'vue';

import Button from '@/components/Button.vue';
import Wordmark from '@/components/Wordmark.vue';

import * as l from './LandingFooter.loc.js';
import {
  API_LIMITS_URL,
  DESIGN_DOCS_URL,
  ISSUES_URL,
  LandingSectionId,
  RELEASES_FEED_URL,
  RELEASES_URL,
  REPOSITORY_URL,
  SYNC_URL,
  WHY_URL,
} from './landingLinks.js';

/** A link of a footer column: to a section of the page (`#features`) or out to GitHub. */
interface FooterLink {
  label: Translation;
  href: string;
}

const emit = defineEmits<{
  /** "Sign in". */
  signIn: [];
}>();

const t = useTranslate();
const productId = useId();
const projectId = useId();
const resourcesId = useId();

const product: FooterLink[] = [
  { label: l.features, href: `#${LandingSectionId.features}` },
  { label: l.keyboard, href: `#${LandingSectionId.keyboard}` },
  { label: l.install, href: `#${LandingSectionId.install}` },
];
const project: FooterLink[] = [
  { label: l.github, href: REPOSITORY_URL },
  { label: l.issues, href: ISSUES_URL },
  { label: l.designDocs, href: DESIGN_DOCS_URL },
  { label: l.releases, href: RELEASES_URL },
];
const resources: FooterLink[] = [
  { label: l.howSyncWorks, href: SYNC_URL },
  { label: l.apiLimits, href: API_LIMITS_URL },
  { label: l.privacy, href: WHY_URL },
];
// The columns of links out to GitHub; "Product" is its own, for "Sign in".
const outside = [
  { id: projectId, heading: l.project, links: project },
  { id: resourcesId, heading: l.resources, links: resources },
];
const social = [
  { icon: Github, label: l.githubRepository, href: REPOSITORY_URL },
  { icon: Rss, label: l.releaseFeed, href: RELEASES_FEED_URL },
];
</script>

<template>
  <footer :class="css.landingFooter">
    <div :class="css.landingFooter_top">
      <div :class="css.landingFooter_brand">
        <Wordmark />
        <p :class="css.landingFooter_tagline">{{ t(l.tagline) }}</p>
      </div>

      <div :class="css.landingFooter_columns">
        <div :class="css.landingFooter_column">
          <h2
            :id="productId"
            :class="css.landingFooter_heading"
          >
            {{ t(l.product) }}
          </h2>
          <ul
            :class="css.landingFooter_links"
            :aria-labelledby="productId"
          >
            <li
              v-for="link in product"
              :key="link.href"
            >
              <a
                :class="css.landingFooter_link"
                :href="link.href"
                >{{ t(link.label) }}</a
              >
            </li>
            <li>
              <Button
                :class="css.landingFooter_link"
                variant="link"
                @click="emit('signIn')"
              >
                {{ t(l.signIn) }}
              </Button>
            </li>
          </ul>
        </div>

        <div
          v-for="column in outside"
          :key="column.id"
          :class="css.landingFooter_column"
        >
          <h2
            :id="column.id"
            :class="css.landingFooter_heading"
          >
            {{ t(column.heading) }}
          </h2>
          <ul
            :class="css.landingFooter_links"
            :aria-labelledby="column.id"
          >
            <li
              v-for="link in column.links"
              :key="link.href"
            >
              <a
                :class="css.landingFooter_link"
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                >{{ t(link.label) }}</a
              >
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div :class="css.landingFooter_bottom">
      <p :class="css.landingFooter_legal">{{ t(l.legal) }}</p>
      <ul :class="css.landingFooter_social">
        <li
          v-for="link in social"
          :key="link.href"
        >
          <a
            :class="css.landingFooter_socialLink"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t(link.label)"
          >
            <component
              :is="link.icon"
              :class="css.landingFooter_socialIcon"
              aria-hidden="true"
            />
          </a>
        </li>
      </ul>
    </div>
  </footer>
</template>

<style lang="scss" module="css">
.landingFooter {
  @include landing-gutter;

  display: flex;
  flex-direction: column;
  gap: 56px;
  padding-block: 64px 48px;
  border-top: 1px solid $color-border;

  @include landing-mobile {
    gap: 40px;
    padding-block: 48px 32px;
  }
}

.landingFooter_top {
  display: flex;
  gap: 36px;
  justify-content: space-between;

  @include landing-mobile {
    flex-direction: column;
  }
}

.landingFooter_brand {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

// The design's `$color-fg-3`, a step up to pass AA.
.landingFooter_tagline {
  font-size: $font-size-lg;
  color: $color-fg-dim;
}

.landingFooter_columns {
  display: flex;
  gap: 96px;

  @include landing-mobile {
    gap: $spacing-24;
    justify-content: space-between;
  }
}

.landingFooter_column {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.landingFooter_heading {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  line-height: 17px;
  color: $color-fg;
}

.landingFooter_links {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  padding: 0;
  margin: 0;
  list-style: none;

  // As tall as the link: no line box of the list's own around it.
  > li {
    display: flex;
  }
}

// A link, and "Sign in" — a button that looks like one (one class deeper than the button's own look).
.landingFooter_links .landingFooter_link {
  @include focus-ring;

  font-size: $font-size-lg;
  line-height: 17px;
  color: $color-fg-2;
  text-decoration: none;
  white-space: nowrap;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}

.landingFooter_bottom {
  display: flex;
  gap: $spacing-16;
  align-items: center;
  justify-content: space-between;
  padding-top: $spacing-24;
  border-top: 1px solid $color-border;

  @include landing-mobile {
    flex-direction: column;
    align-items: flex-start;
  }
}

// The design's `$color-fg-3`, a step up to pass AA.
.landingFooter_legal {
  font-size: $font-size-md;
  color: $color-fg-dim;
}

.landingFooter_social {
  display: flex;
  gap: 18px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.landingFooter_socialLink {
  @include focus-ring;

  display: flex;
  color: $color-fg-3;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}

.landingFooter_socialIcon {
  width: 18px;
  height: 18px;
}
</style>
