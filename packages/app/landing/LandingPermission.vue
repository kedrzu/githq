<!-- What GitHub will ask for when the visitor signs in, and a "Why?" that explains it (githq.pen "Landing — githq.dev", Hero and Final CTA): under each "Sign in with GitHub"; one line on a wide page, centred under its shield on a phone. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ShieldCheck } from 'lucide-vue-next';

import * as l from './LandingPermission.loc.js';
import { WHY_URL } from './landingLinks.js';

const t = useTranslate();
</script>

<template>
  <p :class="css.landingPermission">
    <ShieldCheck
      :class="css.landingPermission_shield"
      aria-hidden="true"
    />
    <span>{{ t(l.permission) }}</span>
    <a
      :class="css.landingPermission_why"
      :href="WHY_URL"
      target="_blank"
      rel="noopener noreferrer"
      >{{ t(l.why) }}</a
    >
  </p>
</template>

<style lang="scss" module="css">
.landingPermission {
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

.landingPermission_shield {
  flex: none;
  width: 13px;
  height: 13px;
}

.landingPermission_why {
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
</style>
