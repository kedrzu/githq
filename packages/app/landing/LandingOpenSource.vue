<!-- The landing page's open source section (githq.pen "Landing — githq.dev", Open source): githq is built in the open, beside a card of its repository on GitHub — its description, language and stack, "Star on GitHub" and its address. The navigation's "Open source" lands here. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Code, Github, Globe, Layers, Star } from 'lucide-vue-next';
import { useId } from 'vue';

import Button from '@/components/Button.vue';

import * as l from './LandingOpenSource.loc.js';
import LandingSectionTitle from './LandingSectionTitle.vue';
import { LandingSectionId, REPOSITORY_URL } from './landingLinks.js';

const t = useTranslate();
const headingId = useId();
</script>

<template>
  <section
    :id="LandingSectionId.openSource"
    :class="css.landingOpenSource"
    :aria-labelledby="headingId"
  >
    <div :class="css.landingOpenSource_copy">
      <LandingSectionTitle
        :eyebrow="t(l.eyebrow)"
        :lines="[t(l.titleLine1), t(l.titleLine2)]"
        :heading-id="headingId"
      />
      <p :class="css.landingOpenSource_body">{{ t(l.body) }}</p>
    </div>

    <div :class="css.landingOpenSource_card">
      <p :class="css.landingOpenSource_repository">
        <Github
          :class="css.landingOpenSource_github"
          aria-hidden="true"
        />
        <span :class="css.landingOpenSource_name">
          {{ t(l.owner) }} <strong :class="css.landingOpenSource_repo">{{ t(l.name) }}</strong>
        </span>
        <span :class="css.landingOpenSource_public">{{ t(l.public) }}</span>
      </p>
      <p :class="css.landingOpenSource_description">{{ t(l.description) }}</p>
      <ul :class="css.landingOpenSource_meta">
        <li :class="css.landingOpenSource_fact">
          <span
            :class="css.landingOpenSource_language"
            aria-hidden="true"
          />
          {{ t(l.language) }}
        </li>
        <li :class="css.landingOpenSource_fact">
          <Layers
            :class="css.landingOpenSource_factIcon"
            aria-hidden="true"
          />
          {{ t(l.stack) }}
        </li>
        <li :class="[css.landingOpenSource_fact, css.landingOpenSource_site]">
          <Globe
            :class="css.landingOpenSource_factIcon"
            aria-hidden="true"
          />
          {{ t(l.site) }}
        </li>
      </ul>
      <div :class="css.landingOpenSource_actions">
        <Button
          :class="css.landingOpenSource_star"
          variant="light"
          size="xl"
          :icon="Star"
          :link="REPOSITORY_URL"
          target="_blank"
        >
          {{ t(l.star) }}
        </Button>
        <Button
          :class="css.landingOpenSource_source"
          size="xl"
          :icon="Code"
          :link="REPOSITORY_URL"
          target="_blank"
        >
          {{ t(l.source) }}
        </Button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.landingOpenSource {
  @include landing-gutter;

  display: flex;
  gap: 80px;
  align-items: center;
  padding-block: 120px;
  border-top: 1px solid $color-border;

  @include landing-narrow {
    flex-direction: column;
    gap: 48px;
    align-items: stretch;
  }

  @include landing-mobile {
    gap: 32px;
    padding-block: 64px;
  }
}

.landingOpenSource_copy {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 22px;
  width: 520px;

  @include landing-narrow {
    width: auto;
  }

  @include landing-mobile {
    gap: 18px;
  }
}

.landingOpenSource_body {
  font-size: 18px;
  line-height: 1.55;
  color: $color-fg-2;

  @include landing-mobile {
    font-size: 16px;
  }
}

.landingOpenSource_card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-24;
  min-width: 0;
  padding: 36px;
  background: radial-gradient(70% 80% at 100% 0%, rgba($color-accent, 0.17), rgba($color-accent, 0)), $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-landing-card;
  box-shadow: $shadow-landing-visual;

  @include landing-narrow {
    flex: none;
  }

  @include landing-mobile {
    gap: 20px;
    padding: $spacing-24;
  }
}

.landingOpenSource_repository {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-12;
  align-items: center;
}

.landingOpenSource_github {
  flex: none;
  width: 28px;
  height: 28px;
  color: $color-fg;
}

.landingOpenSource_name {
  font-family: $font-family-brand;
  font-size: 24px;
  line-height: 1.3;
  color: $color-fg-2;
}

.landingOpenSource_repo {
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.landingOpenSource_public {
  padding: 3px $spacing-10;
  font-size: $font-size-xs;
  line-height: 15px;
  color: $color-fg-2;
  border: 1px solid $color-border-2;
  border-radius: 99px;
}

.landingOpenSource_description {
  font-size: 16px;
  line-height: 1.55;
  color: $color-fg-2;

  @include landing-mobile {
    font-size: $font-size-xl;
  }
}

.landingOpenSource_meta {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8 $spacing-24;
  padding: 0;
  margin: 0;
  list-style: none;

  @include landing-mobile {
    column-gap: 18px;
  }
}

.landingOpenSource_fact {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-lg;
  color: $color-fg-2;
}

// The site is the page the visitor is on: a phone leaves it out.
.landingOpenSource_site {
  @include landing-mobile {
    display: none;
  }
}

.landingOpenSource_language {
  flex: none;
  width: 10px;
  height: 10px;
  background: $color-landing-typescript;
  border-radius: 50%;
}

.landingOpenSource_factIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.landingOpenSource_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-12;
  padding-top: $spacing-8;

  @include landing-mobile {
    flex-direction: column;
    gap: $spacing-10;
  }
}

// Over the buttons' own look (one class deeper): the design's smaller `xl`, the address in mono.
.landingOpenSource_actions > .landingOpenSource_star,
.landingOpenSource_actions > .landingOpenSource_source {
  padding: $spacing-12 18px;
  font-size: $font-size-xl;
  line-height: 18px;

  svg {
    width: 16px;
    height: 16px;
  }
}

.landingOpenSource_actions > .landingOpenSource_star {
  font-weight: $font-weight-semibold;
}

.landingOpenSource_actions > .landingOpenSource_source {
  font-family: $font-family-mono;
  font-size: $font-size-lg;

  svg {
    color: $color-fg-2;
  }
}
</style>
