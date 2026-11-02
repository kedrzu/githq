<!-- The "Required" tag beside a check the base branch requires to pass — in the opened pull request's checks and in the merge panel's. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './RequiredTag.loc.js';

const t = useTranslate();
</script>

<template>
  <span :class="css.requiredTag">{{ t(l.required) }}</span>
</template>

<style lang="scss" module="css">
.requiredTag {
  flex: none;
  padding: 0 5px;
  font-size: $font-size-3xs;
  color: $color-fg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}
</style>
