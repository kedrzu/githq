<!-- The landing page's last call to action (githq.pen "Landing · Getting the app", LP13, LP15): the sygnet, "Every repository you work in" and the call to action (`LandingActions`), over a violet glow from below. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useId, useTemplateRef } from 'vue';

import Sygnet from '@/components/Sygnet.vue';

import type { DesktopSystem } from './desktopBuilds.js';
import LandingActions from './LandingActions.vue';
import * as l from './LandingFinalCta.loc.js';
import { useReveal } from './useReveal.js';

defineProps<{
  /** The visitor's system, `null` while unknown or when there is nothing to install on it. */
  system: DesktopSystem | null;
}>();

const emit = defineEmits<{
  /** "Sign in with GitHub". */
  signIn: [];
}>();

const t = useTranslate();
const headingId = useId();
const reveal = useReveal(useTemplateRef<HTMLElement>('section'));
</script>

<template>
  <section
    ref="section"
    :class="css.landingFinalCta"
    :aria-labelledby="headingId"
    :data-reveal="reveal"
  >
    <Sygnet :class="css.landingFinalCta_sygnet" />
    <h2
      :id="headingId"
      :class="css.landingFinalCta_headline"
    >
      {{ t(l.headline) }}
    </h2>
    <p :class="css.landingFinalCta_sub">{{ t(l.sub) }}</p>
    <LandingActions
      :class="css.landingFinalCta_actions"
      :system="system"
      @sign-in="emit('signIn')"
    />
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
  @include landing-reveal;

  --sygnet-size: 64px;
}

.landingFinalCta_headline {
  @include landing-reveal;

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
  @include landing-reveal;

  max-width: 760px;
  font-size: 19px;
  line-height: 1.5;
  color: $color-fg-2;

  @include landing-mobile {
    font-size: 17px;
  }
}

// The call to action, after the text.
.landingFinalCta_actions {
  @include landing-reveal($landing-reveal-stagger);
}
</style>
