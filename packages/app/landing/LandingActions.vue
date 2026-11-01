<!-- The landing page's call to action (githq.pen "Landing — githq.dev", Hero and Final CTA): "Sign in with GitHub", straight to GitHub's consent screen (D21), beside "Star on GitHub"; stacked on a phone. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Github, Star } from 'lucide-vue-next';

import Button from '@/components/Button.vue';

import * as l from './LandingActions.loc.js';
import { REPOSITORY_URL } from './landingLinks.js';

const emit = defineEmits<{
  /** "Sign in with GitHub". */
  signIn: [];
}>();

const t = useTranslate();
</script>

<template>
  <div :class="css.landingActions">
    <Button
      :class="css.landingActions_signIn"
      variant="light"
      size="xl"
      :icon="Github"
      @click="emit('signIn')"
    >
      {{ t(l.signIn) }}
    </Button>
    <Button
      :class="css.landingActions_star"
      size="xl"
      :icon="Star"
      :link="REPOSITORY_URL"
      target="_blank"
    >
      {{ t(l.star) }}
    </Button>
  </div>
</template>

<style lang="scss" module="css">
.landingActions {
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

// Over the button's own look (one class deeper): the design's heavier label and glow, the quieter star — its
// outline brighter than `border-2`, or beside the glow it reads as the smaller button.
.landingActions > .landingActions_signIn {
  font-weight: $font-weight-semibold;
  box-shadow: 0 0 32px rgba($color-accent, 0.4);
}

.landingActions > .landingActions_star {
  background: $color-bg-2;
  border-color: $color-landing-secondary-border;

  svg {
    width: 16px;
    height: 16px;
    color: $color-fg-2;
  }
}
</style>
