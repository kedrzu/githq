<!-- The landing page's hero (githq.pen "Landing — githq.dev", Hero): what githq is, "Sign in with GitHub" straight to GitHub's consent screen (D21), "Star on GitHub", what GitHub will ask for and why, over a screenshot of the app — the one image the page loads first — under an address bar showing the trick: on load and every 12 s while in view, github.com swaps for githq.dev and the screenshot rises in (`HostSwapLoop`; githq.pen "Landing — motion storyboard"). Under the call to action the development sign-in. -->
<script lang="ts">
const LOOP_EVERY = 12_000;
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useIntersectionObserver } from '@nzyme/vue-utils/useIntersectionObserver.js';
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue';

import HostSwapLoop from './HostSwapLoop.vue';
import LandingActions from './LandingActions.vue';
import * as l from './LandingHero.loc.js';
import LandingPermission from './LandingPermission.vue';
import { useHostSwap } from './useHostSwap.js';

const emit = defineEmits<{
  /** "Sign in with GitHub". */
  signIn: [];
}>();

defineSlots<{
  /** The development sign-in (`DevTokenForm`), under `nuxt dev` and in the local build only. */
  dev?(): unknown;
}>();

const t = useTranslate();
const swap = useHostSwap();
// The screenshot steps away while the address is edited and rises back in on Enter; as it came, it has no state.
const shotState = computed(() => {
  if (swap.step !== 'githq') {
    return 'away';
  }
  return swap.played ? 'entered' : undefined;
});

// The loop plays the first time the hero is in view, then every 12 s while it is.
let inView = false;
let timer: ReturnType<typeof setInterval> | undefined;
useIntersectionObserver({
  element: useTemplateRef<HTMLElement>('stage'),
  onVisible: () => {
    inView = true;
    if (!swap.played) {
      swap.play();
    }
  },
  onHidden: () => {
    inView = false;
  },
});

onMounted(() => {
  timer = setInterval(() => inView && swap.play(), LOOP_EVERY);
});

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section :class="css.landingHero">
    <h1 :class="css.landingHero_headline">{{ t(l.headline) }}</h1>
    <p :class="css.landingHero_subhead">{{ t(l.subhead) }}</p>

    <LandingActions @sign-in="emit('signIn')" />

    <div :class="css.landingHero_finePrint">
      <p :class="css.landingHero_reassurance">
        <span>{{ t(l.reassuranceSetup) }}</span>
        <span :class="css.landingHero_reassuranceRest">{{ t(l.reassuranceStorage) }}</span>
      </p>
      <LandingPermission />
    </div>

    <div
      v-if="$slots.dev"
      :class="css.landingHero_dev"
    >
      <slot name="dev" />
    </div>

    <div
      ref="stage"
      :class="css.landingHero_stage"
    >
      <!-- Shows what the copy says; the address in it means nothing on its own. -->
      <p
        :class="css.landingHero_address"
        aria-hidden="true"
      >
        <HostSwapLoop
          :step="swap.step"
          :host="swap.host"
        />
      </p>
      <div
        :class="css.landingHero_shot"
        :data-swap="shotState"
      >
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
$shot-shadow: 0 40px 120px rgb(0 0 0 / 80%);

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

// The storyboard's address bar, as wide as its longest address so the swap moves nothing around it.
.landingHero_address {
  display: flex;
  align-items: center;
  width: min(100%, 264px);
  padding: $spacing-10 $spacing-12;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  line-height: 16px;
  color: $color-fg;
  text-align: left;
  white-space: nowrap;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.landingHero_shot {
  position: relative;
  overflow: hidden;
  border: 1px solid $color-border-2;
  border-radius: 14px;
  box-shadow:
    $shot-shadow,
    0 -10px 90px rgba($color-accent, 0.2);

  // The app runs on below the fold: its bottom fades into the page.
  &::after {
    position: absolute;
    inset: 57% 0 0;
    content: '';
    background: linear-gradient(180deg, rgba($color-bg, 0), $color-bg);
  }

  @media (prefers-reduced-motion: no-preference) {
    transition:
      opacity $landing-motion-duration ease-out,
      transform $landing-motion-duration ease-out;

    // Away while the address is edited: dimmed and lowered, so Enter brings githq up into place.
    &[data-swap='away'] {
      opacity: 0.4;
      transform: translateY(16px);
    }

    &[data-swap='entered'] {
      animation: hero-glow $landing-motion-duration ease-out;
    }
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

// The accent glow above the screenshot pulses once as githq comes up.
@keyframes hero-glow {
  50% {
    box-shadow:
      $shot-shadow,
      0 -10px 120px rgba($color-accent, 0.45);
  }
}
</style>
