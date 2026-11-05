<!-- What GitHub will ask for when the visitor signs in, and a "Why?" that explains it (githq.pen "Landing — githq.dev"): under "Sign in with GitHub" on `/download` (D35); one run of text, starting at its shield. -->
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
// One run of text: the shield and "Why?" stay with its first and last words, however it wraps.
.landingPermission {
  font-size: $font-size-md;
  line-height: 1.45;
  color: $color-fg-dim;
  text-align: left;
}

.landingPermission_shield {
  display: inline;
  width: 13px;
  height: 13px;
  margin-right: $spacing-6;
  vertical-align: -2px;
}

.landingPermission_why {
  @include focus-ring;

  margin-left: $spacing-6;
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
