<!-- The amber dot on a stack's row of a pull request with the viewer's draft review (code review D25, `Review / Stack`), its meaning for those who can't see it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './DraftDot.loc.js';

const t = useTranslate();
</script>

<template>
  <span :class="css.draftDot">
    <span :class="css.draftDot_text">{{ t(l.draftReview) }}</span>
  </span>
</template>

<style lang="scss" module="css">
.draftDot {
  flex: none;
  width: 7px;
  height: 7px;
  background: $color-amber;
  border-radius: 50%;
}

.draftDot_text {
  @include visually-hidden;
}
</style>
