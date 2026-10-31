<!-- The landing page at `/` for a signed-out visitor (githq.pen "Landing — githq.dev"): the hero — what githq is, "Sign in with GitHub" straight to GitHub's consent screen (D21), "Star on GitHub", what GitHub will ask for and why — over a screenshot of the app. Above it the banner of a sign-in that didn't finish (G1); under the call to action the development sign-in. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Github, Star } from 'lucide-vue-next';

import Button from '@/components/Button.vue';
import Wordmark from '@/components/Wordmark.vue';

import * as l from './LandingScreen.loc.js';

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

// The repository on GitHub, where "Star on GitHub" goes, and why githq asks for what it does — the design's
// "What githq keeps in your browser" there, until a page of its own.
const REPOSITORY_URL = 'https://github.com/kedrzu/githq';
const WHY_URL = `${REPOSITORY_URL}/blob/main/docs/design/githq/README.md#what-githq-keeps-in-your-browser`;

const t = useTranslate();
</script>

<template>
  <div :class="css.landingScreen">
    <header :class="css.landingScreen_nav">
      <Wordmark />
    </header>

    <main :class="css.landingScreen_main">
      <div
        v-if="$slots.banner"
        :class="css.landingScreen_banner"
      >
        <slot name="banner" />
      </div>

      <section :class="css.landingScreen_hero">
        <h1 :class="css.landingScreen_headline">{{ t(l.headline) }}</h1>
        <p :class="css.landingScreen_subhead">{{ t(l.subhead) }}</p>

        <div :class="css.landingScreen_actions">
          <Button
            variant="light"
            size="lg"
            :icon="Github"
            @click="emit('signIn')"
          >
            {{ t(l.signIn) }}
          </Button>
          <Button
            size="lg"
            :icon="Star"
            :link="REPOSITORY_URL"
            target="_blank"
          >
            {{ t(l.star) }}
          </Button>
        </div>

        <p :class="css.landingScreen_reassurance">{{ t(l.reassurance) }}</p>
        <p :class="css.landingScreen_permission">
          {{ t(l.permission) }}
          <a
            :class="css.landingScreen_why"
            :href="WHY_URL"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t(l.why) }}</a
          >
        </p>

        <div
          v-if="$slots.dev"
          :class="css.landingScreen_dev"
        >
          <slot name="dev" />
        </div>
      </section>

      <img
        :class="css.landingScreen_shot"
        src="/landing/hero-my-work.webp"
        width="2400"
        height="1501"
        fetchpriority="high"
        :alt="t(l.heroAlt)"
      />
    </main>
  </div>
</template>

<style lang="scss" module="css">
.landingScreen {
  min-height: 100%;
  background: $color-bg;
}

.landingScreen_nav {
  display: flex;
  align-items: center;
  max-width: 1200px;
  padding: $spacing-24;
  margin: 0 auto;
}

.landingScreen_main {
  display: flex;
  flex-direction: column;
  gap: 56px;
  align-items: center;
  max-width: 1200px;
  padding: $spacing-24 $spacing-24 80px;
  margin: 0 auto;
}

.landingScreen_banner {
  width: 100%;
  max-width: 760px;
}

.landingScreen_hero {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  max-width: 680px;
  text-align: center;
}

.landingScreen_headline {
  font-size: clamp(34px, 6vw, 56px);
  font-weight: $font-weight-semibold;
  line-height: 1.08;
  letter-spacing: -0.03em;
  white-space: pre-line;
}

.landingScreen_subhead {
  font-size: 17px;
  line-height: 1.55;
  color: $color-fg-2;
}

.landingScreen_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-12;
  justify-content: center;
  padding-top: $spacing-8;
}

.landingScreen_reassurance {
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.landingScreen_permission {
  max-width: 460px;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.landingScreen_why {
  @include focus-ring;

  margin-left: $spacing-4;
  color: $color-fg-2;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    color: $color-fg;
  }
}

.landingScreen_dev {
  width: 100%;
  max-width: 440px;
  text-align: left;
}

.landingScreen_shot {
  width: 100%;
  height: auto;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
}
</style>
