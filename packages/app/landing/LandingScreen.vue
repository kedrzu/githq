<!-- The landing page at `/` for a signed-out visitor (githq.pen "Landing — githq.dev"), its sections top to bottom: the navigation, the hero — "Sign in with GitHub" straight to GitHub's consent screen (D21) — with the banner of a sign-in that didn't finish (G1) above it and the development sign-in under its call to action, the GitHub concepts githq is built on, the statement, the four features, the details, the comparison, open source, the last call to action, and the footer. Every "Sign in" emits `signIn`. -->
<script lang="ts" setup>
import LandingComparison from './LandingComparison.vue';
import LandingDetails from './LandingDetails.vue';
import LandingFeatures from './LandingFeatures.vue';
import LandingFinalCta from './LandingFinalCta.vue';
import LandingFooter from './LandingFooter.vue';
import LandingHero from './LandingHero.vue';
import LandingNav from './LandingNav.vue';
import LandingOpenSource from './LandingOpenSource.vue';
import LandingStatement from './LandingStatement.vue';
import LandingStrip from './LandingStrip.vue';

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

      <LandingHero @sign-in="emit('signIn')">
        <template
          v-if="$slots.dev"
          #dev
        >
          <slot name="dev" />
        </template>
      </LandingHero>
      <LandingStrip />
      <LandingStatement />
      <LandingFeatures />
      <LandingDetails />
      <LandingComparison />
      <LandingOpenSource />
      <LandingFinalCta @sign-in="emit('signIn')" />
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
