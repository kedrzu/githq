<!-- The landing page's statement (githq.pen "Landing — githq.dev", Statement): githq is not another tracker but a faster way to work GitHub's — everything stays on GitHub and every change is an ordinary GitHub change. The navigation's "How it works" lands here. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './LandingStatement.loc.js';
import { LandingSectionId } from './landingLinks.js';

const t = useTranslate();
</script>

<template>
  <section
    :id="LandingSectionId.howItWorks"
    :class="css.landingStatement"
  >
    <h2 :class="css.landingStatement_title">
      <span :class="css.landingStatement_line">{{ t(l.title) }}</span>
      <span :class="[css.landingStatement_line, css.landingStatement_line_dim]">{{ t(l.subtitle) }}</span>
    </h2>
    <p :class="css.landingStatement_body">{{ t(l.body) }}</p>
  </section>
</template>

<style lang="scss" module="css">
.landingStatement {
  @include landing-gutter;

  display: flex;
  flex-direction: column;
  gap: 40px;
  padding-block: 96px 120px;
  border-top: 1px solid $color-border;

  @include landing-mobile {
    gap: $spacing-24;
    padding-block: 56px 72px;
  }
}

.landingStatement_title {
  max-width: 960px;
  font-family: $font-family-brand;
  font-size: clamp(30px, 3.06cqi, 44px);
  font-weight: $font-weight-medium;
  line-height: 1.18;
  letter-spacing: -0.03em;
}

.landingStatement_line {
  display: block;
  color: $color-fg;
}

// Large text: `$color-fg-3` passes AA's 3:1 for it.
.landingStatement_line_dim {
  color: $color-fg-3;
}

.landingStatement_body {
  max-width: 820px;
  font-size: 20px;
  line-height: 1.55;
  color: $color-fg-dim;

  @include landing-mobile {
    font-size: 17px;
  }
}
</style>
