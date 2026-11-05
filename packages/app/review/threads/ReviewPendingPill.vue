<!-- Beside a comment still in the viewer's draft (`Review / Comment · pending`): only they see it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './ReviewPendingPill.loc.js';

const t = useTranslate();
</script>

<template>
  <span :class="css.reviewPendingPill">{{ t(l.pending) }}</span>
</template>

<style lang="scss" module="css">
.reviewPendingPill {
  flex: none;
  padding: 1px $spacing-6;
  font-size: $font-size-3xs;
  font-weight: $font-weight-medium;
  color: $color-amber;
  background: rgba($color-amber, 0.12);
  border-radius: $radius-sm;
}
</style>
