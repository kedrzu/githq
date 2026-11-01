<!-- The landing page's last call to action (githq.pen "Landing — githq.dev", Final CTA): the sygnet, "Your issues are already here", "Sign in with GitHub" — straight to GitHub's consent screen (D21) — and "Star on GitHub", and what GitHub will ask for and why, over a violet glow from below. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useId } from 'vue';

import Sygnet from '@/components/Sygnet.vue';

import LandingActions from './LandingActions.vue';
import * as l from './LandingFinalCta.loc.js';
import LandingPermission from './LandingPermission.vue';

const emit = defineEmits<{
  /** "Sign in with GitHub". */
  signIn: [];
}>();

const t = useTranslate();
const headingId = useId();
</script>

<template>
  <section
    :class="css.landingFinalCta"
    :aria-labelledby="headingId"
  >
    <Sygnet :class="css.landingFinalCta_sygnet" />
    <h2
      :id="headingId"
      :class="css.landingFinalCta_headline"
    >
      {{ t(l.headline) }}
    </h2>
    <p :class="css.landingFinalCta_sub">{{ t(l.sub) }}</p>
    <LandingActions @sign-in="emit('signIn')" />
    <LandingPermission />
  </section>
</template>

<style lang="scss" module="css">
.landingFinalCta {
  @include landing-gutter;

  display: flex;
  flex-direction: column;
  gap: 28px;
  align-items: center;
  padding-block: 160px;
  text-align: center;
  background: radial-gradient(60% 70% at 50% 100%, rgba($color-accent, 0.2), rgba($color-accent, 0));
  border-top: 1px solid $color-border;

  @include landing-mobile {
    gap: 22px;
    padding-block: 96px;
  }
}

.landingFinalCta_sygnet {
  --sygnet-size: 64px;
}

.landingFinalCta_headline {
  max-width: 960px;
  font-family: $font-family-brand;
  font-size: clamp(36px, 4.44cqi, 64px);
  font-weight: $font-weight-semibold;
  line-height: 1.05;
  color: $color-fg;
  letter-spacing: -0.0375em;
  white-space: pre-line;

  @include landing-mobile {
    line-height: 1.06;
    letter-spacing: -0.033em;
  }
}

.landingFinalCta_sub {
  max-width: 700px;
  font-size: 19px;
  line-height: 1.5;
  color: $color-fg-2;

  @include landing-mobile {
    font-size: 17px;
  }
}
</style>
