<!-- The landing page at `/` for a signed-out visitor (githq.pen "Landing — githq.dev"), its sections top to bottom: the navigation, the hero — downloading the app or signing in with GitHub, straight to its consent screen (D21) — with the banner of a sign-in that didn't finish (G1) above it and the development sign-in under its call to action, its two promises and why they matter now — every repository in one place, no separate tracker with the comparison, leading a team of agents —, the GitHub concepts githq is built on, three features, the details, open source, the last call to action, and the footer. Every "Sign in" emits `signIn`. -->
<script lang="ts" setup>
import type { DesktopSystem } from './desktopBuilds.js';
import LandingComparison from './LandingComparison.vue';
import LandingDetails from './LandingDetails.vue';
import LandingFeatures from './LandingFeatures.vue';
import LandingFinalCta from './LandingFinalCta.vue';
import LandingFooter from './LandingFooter.vue';
import LandingHero from './LandingHero.vue';
import LandingNav from './LandingNav.vue';
import LandingOnePlace from './LandingOnePlace.vue';
import LandingOpenSource from './LandingOpenSource.vue';
import LandingStrip from './LandingStrip.vue';
import LandingWhyNow from './LandingWhyNow.vue';

defineProps<{
  /** The visitor's system, `null` while unknown or when there is nothing to install on it. */
  system: DesktopSystem | null;
}>();

const emit = defineEmits<{
  /** "Sign in" in the navigation and the footer, "Sign in with GitHub" in the hero and the last call to action. */
  signIn: [];
}>();

defineSlots<{
  /** Why the visitor is back from a sign-in (`SignInBanner`). */
  banner?(): unknown;
  /** The development sign-in (`DevTokenForm`), under `nuxt dev` and in the local build only. */
  dev?(): unknown;
}>();
</script>

<template>
  <div :class="css.landingScreen">
    <LandingNav @sign-in="emit('signIn')" />

    <main>
      <div
        v-if="$slots.banner"
        :class="css.landingScreen_banner"
      >
        <slot name="banner" />
      </div>

      <LandingHero
        :system="system"
        @sign-in="emit('signIn')"
      >
        <template
          v-if="$slots.dev"
          #dev
        >
          <slot name="dev" />
        </template>
      </LandingHero>
      <LandingOnePlace />
      <LandingComparison />
      <LandingWhyNow />
      <LandingStrip />
      <LandingFeatures />
      <LandingDetails />
      <LandingOpenSource />
      <LandingFinalCta
        :system="system"
        @sign-in="emit('signIn')"
      />
    </main>

    <LandingFooter @sign-in="emit('signIn')" />
  </div>
</template>

<style lang="scss" module="css">
// The container the sections' layouts follow (`landing-narrow`, `landing-mobile`, `landing-gutter`).
.landingScreen {
  min-height: 100%;
  container: landing / inline-size;
  background: $color-bg;
}

// A section a link lands on starts under the pinned navigation, its top border behind the navigation's.
.landingScreen [id] {
  scroll-margin-top: $landing-nav-height;

  @include landing-mobile {
    scroll-margin-top: $landing-nav-height-mobile;
  }
}

.landingScreen_banner {
  @include landing-gutter;

  display: flex;
  justify-content: center;
  padding-top: $spacing-24;

  > * {
    width: 100%;
    max-width: 760px;
  }
}
</style>
