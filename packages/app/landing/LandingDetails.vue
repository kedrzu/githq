<!-- The landing page's details bento (githq.pen "Landing — githq.dev", Details bento): seven cards of the small things — swapping github.com for githq.dev in an address, free, no server, gentle on the API limit, installable, anywhere on GitHub, reviews on github.com — in rows of two, three and two; one under another on a phone. In "Swap the host" githq's address types its host over GitHub's (`HostSwapLoop`) when the bento first scrolls into view and whenever the pointer comes over the card. The navigation's "How it works" lands here, the footer's "Install the app" on its card. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { AppWindow, BadgeDollarSign, Gauge, GitMerge, Globe, Link, Lock, ServerOff } from 'lucide-vue-next';
import { useId, useTemplateRef, watch } from 'vue';

import * as l from './LandingDetails.loc.js';
import LandingDetail from './LandingDetail.vue';
import LandingSectionTitle from './LandingSectionTitle.vue';
import { LandingSectionId } from './landingLinks.js';
import HostSwapLoop from './HostSwapLoop.vue';
import { GITHUB_HOST, SWAP_PATH, useHostSwap } from './useHostSwap.js';
import { useReveal } from './useReveal.js';

const t = useTranslate();
const headingId = useId();
const reveal = useReveal(useTemplateRef<HTMLElement>('section'));

const swap = useHostSwap();

watch(reveal, state => state === 'revealed' && swap.play());
</script>

<template>
  <section
    :id="LandingSectionId.howItWorks"
    ref="section"
    :class="css.landingDetails"
    :aria-labelledby="headingId"
    :data-reveal="reveal"
  >
    <LandingSectionTitle
      :class="css.landingDetails_title"
      :eyebrow="t(l.eyebrow)"
      :lines="[t(l.titleLine1), t(l.titleLine2)]"
      :heading-id="headingId"
    />

    <ul :class="css.landingDetails_grid">
      <LandingDetail
        :class="[css.landingDetails_tall, css.landingDetails_wide, css.landingDetails_swap]"
        :icon="Link"
        :title="t(l.swapTitle)"
        :body="t(l.swapBody)"
        @pointerenter="swap.play()"
      >
        <div :class="css.landingDetails_addresses">
          <p :class="css.landingDetails_address">
            <Lock
              :class="css.landingDetails_lock"
              aria-hidden="true"
            />
            <span :class="css.landingDetails_hidden">{{ t(l.swapBefore) }}: </span
            ><span :class="css.landingDetails_scheme">https://</span
            ><span :class="css.landingDetails_host">{{ GITHUB_HOST }}</span
            ><span :class="css.landingDetails_path">{{ SWAP_PATH }}</span>
          </p>
          <p :class="[css.landingDetails_address, css.landingDetails_address_githq]">
            <Lock
              :class="css.landingDetails_lock"
              aria-hidden="true"
            />
            <span :class="css.landingDetails_hidden">{{ t(l.swapAfter) }}: </span
            ><span :class="css.landingDetails_scheme">https://</span
            ><HostSwapLoop
              :step="swap.step"
              :host="swap.host"
            />
          </p>
        </div>
      </LandingDetail>
      <LandingDetail
        :class="[css.landingDetails_tall, css.landingDetails_narrow]"
        :icon="BadgeDollarSign"
        :title="t(l.freeTitle)"
        :body="t(l.freeBody)"
      />

      <LandingDetail
        :class="css.landingDetails_third"
        :icon="ServerOff"
        :title="t(l.serverTitle)"
        :body="t(l.serverBody)"
      />
      <LandingDetail
        :class="css.landingDetails_third"
        :icon="Gauge"
        :title="t(l.limitTitle)"
        :body="t(l.limitBody)"
      />
      <LandingDetail
        :id="LandingSectionId.install"
        :class="css.landingDetails_third"
        :icon="AppWindow"
        :title="t(l.installTitle)"
        :body="t(l.installBody)"
      />

      <LandingDetail
        :class="css.landingDetails_half"
        :icon="Globe"
        :title="t(l.anywhereTitle)"
        :body="t(l.anywhereBody)"
      />
      <LandingDetail
        :class="css.landingDetails_half"
        :icon="GitMerge"
        :title="t(l.reviewsTitle)"
        :body="t(l.reviewsBody)"
      />
    </ul>
  </section>
</template>

<style lang="scss" module="css">
$gap: 16px;

.landingDetails {
  @include landing-gutter;

  display: flex;
  flex-direction: column;
  gap: 56px;
  padding-block: 120px;
  border-top: 1px solid $color-border;

  @include landing-mobile {
    gap: 32px;
    padding-block: 64px;
  }
}

.landingDetails_title {
  @include landing-reveal;
}

// Rows of two (wide and narrow), three and two cards; the widths of a row add up to the whole, gaps included.
.landingDetails_grid {
  @include landing-reveal($landing-reveal-stagger);

  display: flex;
  flex-wrap: wrap;
  gap: $gap;
  padding: 0;
  margin: 0;
  list-style: none;

  @include landing-mobile {
    flex-direction: column;
  }
}

// Over the card's own look (one class deeper). On a phone the cards are as tall as their text.
.landingDetails_grid > .landingDetails_tall {
  min-height: 340px;
}

.landingDetails_grid > .landingDetails_wide {
  flex: 1 1 calc((100% - #{$gap}) * 0.64 - 1px);
}

.landingDetails_grid > .landingDetails_narrow {
  flex: 1 1 calc((100% - #{$gap}) * 0.36 - 1px);
}

.landingDetails_grid > .landingDetails_third {
  flex: 1 1 calc((100% - #{2 * $gap}) / 3 - 1px);
  min-height: 260px;
}

.landingDetails_grid > .landingDetails_half {
  flex: 1 1 calc((100% - #{$gap}) / 2 - 1px);
  min-height: 220px;
}

.landingDetails_grid > .landingDetails_tall,
.landingDetails_grid > .landingDetails_third,
.landingDetails_grid > .landingDetails_half {
  @include landing-mobile {
    flex-basis: auto;
    min-height: 0;
  }
}

// The violet glow from the bottom right.
.landingDetails_grid > .landingDetails_swap {
  background: radial-gradient(60% 70% at 85% 100%, rgba($color-accent, 0.14), rgba($color-accent, 0)), $color-bg-2;
}

.landingDetails_addresses {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.landingDetails_address {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: $spacing-12 $spacing-16;
  overflow: hidden;
  font-family: $font-family-mono;
  font-size: $font-size-lg;
  line-height: 18px;
  color: $color-fg-2;
  white-space: nowrap;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-xl;

  @include landing-mobile {
    font-size: $font-size-md;
  }
}

.landingDetails_address_githq {
  background: $color-bg-3;
  border-color: rgba($color-accent, 0.4);
}

.landingDetails_lock {
  flex: none;
  width: 13px;
  height: 13px;
  margin-right: 17px;
  color: $color-fg-3;

  @include landing-mobile {
    margin-right: 8px;
  }
}

// The design's `$color-fg-3`, a step up to pass AA.
.landingDetails_scheme {
  color: $color-fg-dim;

  @include landing-mobile {
    display: none;
  }
}

.landingDetails_host {
  font-weight: $font-weight-semibold;
}

.landingDetails_hidden {
  @include visually-hidden;
}

.landingDetails_path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
