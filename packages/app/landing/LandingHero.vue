<!-- The landing page's hero (githq.pen "Landing — githq.dev", Hero): what githq is, "Sign in with GitHub" straight to GitHub's consent screen (D21), "Star on GitHub", what GitHub will ask for and why, over a screenshot of the app — the one image the page loads first. Under the call to action the development sign-in. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Github, ShieldCheck, Star } from 'lucide-vue-next';

import Button from '@/components/Button.vue';

import * as l from './LandingHero.loc.js';
import { REPOSITORY_URL, WHY_URL } from './landingLinks.js';

const emit = defineEmits<{
  /** "Sign in with GitHub". */
  signIn: [];
}>();

defineSlots<{
  /** The development sign-in (`DevTokenForm`), under `nuxt dev` and in the local build only. */
  dev?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <section :class="css.landingHero">
    <h1 :class="css.landingHero_headline">{{ t(l.headline) }}</h1>
    <p :class="css.landingHero_subhead">{{ t(l.subhead) }}</p>

    <div :class="css.landingHero_actions">
      <Button
        :class="css.landingHero_signIn"
        variant="light"
        size="xl"
        :icon="Github"
        @click="emit('signIn')"
      >
        {{ t(l.signIn) }}
      </Button>
      <Button
        :class="css.landingHero_star"
        size="xl"
        :icon="Star"
        :link="REPOSITORY_URL"
        target="_blank"
      >
        {{ t(l.star) }}
      </Button>
    </div>

    <div :class="css.landingHero_finePrint">
      <p :class="css.landingHero_reassurance">
        <span>{{ t(l.reassuranceSetup) }}</span>
        <span :class="css.landingHero_reassuranceRest">{{ t(l.reassuranceStorage) }}</span>
      </p>
      <p :class="css.landingHero_permission">
        <ShieldCheck
          :class="css.landingHero_shield"
          aria-hidden="true"
        />
        <span>{{ t(l.permission) }}</span>
        <a
          :class="css.landingHero_why"
          :href="WHY_URL"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t(l.why) }}</a
        >
      </p>
    </div>

    <div
      v-if="$slots.dev"
      :class="css.landingHero_dev"
    >
      <slot name="dev" />
    </div>

    <div :class="css.landingHero_stage">
      <div :class="css.landingHero_shot">
        <img
          :class="css.landingHero_image"
          src="/landing/hero-my-work.webp"
          width="2400"
          height="1501"
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
  padding-top: 120px;
  text-align: center;
  background: radial-gradient(ellipse 55% 35% at 50% 18%, rgba($color-accent, 0.18), rgba($color-accent, 0));

  @include landing-mobile {
    gap: 20px;
    padding-top: 56px;
  }
}

.landingHero_headline {
  max-width: 1080px;
  font-family: $font-family-brand;
  font-size: clamp(38px, 5.56cqi, 80px);
  font-weight: $font-weight-semibold;
  line-height: 1.03;
  color: $color-landing-headline-bottom;
  letter-spacing: -0.04em;
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

.landingHero_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-12;
  justify-content: center;
  padding-top: $spacing-8;

  @include landing-mobile {
    flex-direction: column;
    gap: $spacing-10;
    align-self: stretch;
  }
}

// Over the button's own look (one class deeper): the design's heavier label and glow, the quieter star.
.landingHero_actions > .landingHero_signIn {
  font-weight: $font-weight-semibold;
  box-shadow: 0 0 32px rgba($color-accent, 0.4);
}

.landingHero_actions > .landingHero_star {
  background: $color-bg-2;

  svg {
    width: 16px;
    height: 16px;
    color: $color-fg-2;
  }
}

.landingHero_finePrint {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  align-items: center;
}

// "No install · No new tracker · Nothing stored outside GitHub": one line, two on a phone.
.landingHero_reassurance {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  line-height: 1.6;
  color: $color-fg-dim;
  letter-spacing: 0.2px;

  @include landing-mobile {
    display: flex;
    flex-direction: column;
  }
}

.landingHero_reassuranceRest::before {
  content: ' · ' / '';

  @include landing-mobile {
    content: none;
  }
}

.landingHero_permission {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  font-size: $font-size-md;
  line-height: 1.45;
  color: $color-fg-dim;

  @include landing-mobile {
    flex-direction: column;
    padding-inline: $spacing-12;
    padding-top: $spacing-4;
  }
}

.landingHero_shield {
  flex: none;
  width: 13px;
  height: 13px;
}

.landingHero_why {
  @include focus-ring;

  font-weight: $font-weight-medium;
  color: $color-fg-2;
  text-decoration: underline;
  text-underline-offset: 2px;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}

.landingHero_dev {
  width: 100%;
  max-width: 440px;
  text-align: left;
}

.landingHero_stage {
  width: 100%;
  padding-top: 40px;

  @include landing-mobile {
    padding-top: 32px;
  }
}

.landingHero_shot {
  position: relative;
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
</style>
