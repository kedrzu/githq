<!-- The landing page's hero (githq.pen "Landing — githq.dev"): at its top, on its gradient, the banner of a sign-in that didn't finish, then "Star on GitHub" as a pill above the headline, what githq is, the call to action (`LandingActions`), over a screenshot of the app — the one image the page loads first, which rises in once as the page opens. Under the call to action the development sign-in. -->
<script lang="ts" setup>
import { NuxtImg } from '#components';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowRight, Star } from 'lucide-vue-next';

import type { DesktopSystem } from './desktopBuilds.js';
import LandingActions from './LandingActions.vue';
import * as l from './LandingHero.loc.js';
import { REPOSITORY_URL } from './landingLinks.js';

defineProps<{
  /** The visitor's system, `null` while unknown or when there is nothing to install on it. */
  system: DesktopSystem | null;
}>();

const emit = defineEmits<{
  /** "Sign in with GitHub". */
  signIn: [];
}>();

defineSlots<{
  /** Why the visitor is back from a sign-in (`SignInBanner`). */
  banner?(): unknown;
  /** The development sign-in (`DevTokenForm`), under `nuxt dev` and in the local build only. */
  dev?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <section :class="[css.landingHero, $slots.banner && css.landingHero__banner]">
    <div
      v-if="$slots.banner"
      :class="css.landingHero_banner"
    >
      <slot name="banner" />
    </div>

    <a
      :class="css.landingHero_star"
      :href="REPOSITORY_URL"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Star
        :class="css.landingHero_starIcon"
        aria-hidden="true"
      />
      {{ t(l.star) }}
      <ArrowRight
        :class="css.landingHero_starArrow"
        aria-hidden="true"
      />
    </a>

    <h1 :class="css.landingHero_headline">{{ t(l.headline) }}</h1>
    <p :class="css.landingHero_subhead">{{ t(l.subhead) }}</p>

    <LandingActions
      :system="system"
      @sign-in="emit('signIn')"
    />

    <div
      v-if="$slots.dev"
      :class="css.landingHero_dev"
    >
      <slot name="dev" />
    </div>

    <div :class="css.landingHero_stage">
      <div :class="css.landingHero_shot">
        <NuxtImg
          :class="css.landingHero_image"
          src="/landing/hero-my-work.webp"
          width="2400"
          height="1500"
          sizes="320:134vw 720:84vw 1080:84vw 1440:1200px"
          fetchpriority="high"
          :alt="t(l.heroAlt)"
        />
      </div>
    </div>
  </section>
</template>

<style lang="scss" module="css">
.landingHero {
  @include landing-gutter;

  display: flex;
  flex-direction: column;
  gap: 28px;
  align-items: center;
  padding-top: 88px;
  padding-bottom: 100px;
  text-align: center;
  background: radial-gradient(ellipse 55% 35% at 50% 18%, rgba($color-accent, 0.18), rgba($color-accent, 0));

  @include landing-mobile {
    gap: 20px;
    padding-top: 32px;
    padding-bottom: 56px;
  }
}

// The banner takes the room the headline has above it otherwise, so it sits close under the navigation.
.landingHero__banner {
  padding-top: 40px;

  @include landing-mobile {
    padding-top: 20px;
  }
}

.landingHero_banner {
  width: 100%;
  max-width: 760px;
  margin-bottom: $spacing-16;
  text-align: left;
}

.landingHero_star {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
  padding: 7px 14px;
  font-size: $font-size-md;
  color: $color-fg;
  text-decoration: none;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: 999px;

  &:hover {
    background: $color-bg-3;
  }
}

.landingHero_starIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-amber;
}

.landingHero_starArrow {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.landingHero_headline {
  max-width: 1080px;
  font-family: $font-family-brand;
  font-size: clamp(38px, 5.56cqi, 80px);
  font-weight: $font-weight-semibold;
  line-height: 1.03;
  color: $color-landing-headline-bottom;
  letter-spacing: -0.04em;
  text-wrap: balance;
  white-space: pre-line;
  background: linear-gradient(0deg, $color-landing-headline-bottom 35%, $color-landing-headline-top 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;

  @include landing-mobile {
    line-height: 1.04;
    letter-spacing: -0.037em;
  }
}

.landingHero_subhead {
  max-width: 680px;
  font-size: 20px;
  line-height: 1.5;
  color: $color-fg-2;

  @include landing-mobile {
    font-size: 17px;
  }
}

.landingHero_dev {
  width: 100%;
  max-width: 440px;
  text-align: left;
}

.landingHero_stage {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  align-items: center;
  width: 100%;
  padding-top: 40px;

  @include landing-mobile {
    padding-top: 32px;
  }
}

.landingHero_shot {
  position: relative;
  width: 100%;
  overflow: hidden;
  border: 1px solid $color-border-2;
  border-radius: 14px;
  box-shadow:
    0 40px 120px rgb(0 0 0 / 80%),
    0 -10px 90px rgba($color-accent, 0.2);

  // The app runs on below the fold: its bottom fades into the page.
  &::after {
    position: absolute;
    inset: 57% 0 0;
    content: '';
    background: linear-gradient(180deg, rgba($color-bg, 0), $color-bg);
  }

  // Once, as the page opens: no state and no script, so the prerendered page plays it too, and where it does not
  // play the screenshot simply stands in place. Starts visible, so the page's first image is painted at once.
  @media (prefers-reduced-motion: no-preference) {
    animation: hero-rise-in $landing-motion-duration ease-out;
  }

  @include landing-mobile {
    aspect-ratio: 350 / 292;
    border-radius: 12px;

    &::after {
      inset-block-start: 52%;
    }
  }
}

.landingHero_image {
  display: block;
  width: 100%;
  height: auto;

  // A phone shows the list's left part, larger, instead of the whole window shrunk.
  @include landing-mobile {
    height: 100%;
    object-fit: cover;
    object-position: left top;
  }
}

@keyframes hero-rise-in {
  from {
    opacity: 0.4;
    transform: translateY(16px);
  }
}
</style>
