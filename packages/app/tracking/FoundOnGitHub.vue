<!-- What GitHub's search found for the chooser's filter (mobile D34, G18, G19): after the user's own matches, under "On GitHub · not in your lists · from GitHub's search", the rows the chooser gives it. While GitHub answers one calm line says so, no spinner; with nothing found, or no answer, one line says that. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { GitHubSearch } from '@/utils/useGitHubSearch.js';

import * as l from './FoundOnGitHub.loc.js';

defineProps<{
  /** Where the search stands. */
  state: GitHubSearch<unknown>['kind'];
  /** What GitHub was asked, as typed. */
  text: string;
  /** How many rows the slot shows. */
  count: number;
}>();

defineSlots<{
  /** The rows found. */
  default(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <div :class="css.foundOnGitHub_head">
    <h2 :class="css.foundOnGitHub_name">{{ t(l.heading) }}</h2>
    <span :class="css.foundOnGitHub_detail">{{ state === 'asking' ? t(l.searching) : t(l.detail) }}</span>
  </div>
  <slot />
  <p
    v-if="state === 'asking'"
    :class="css.foundOnGitHub_line"
    role="status"
  >
    {{ t(l.asking, { text }) }}
  </p>
  <p
    v-else-if="state === 'failed'"
    :class="css.foundOnGitHub_line"
    role="alert"
  >
    {{ t(l.failed) }}
  </p>
  <p
    v-else-if="state === 'answered' && count === 0"
    :class="css.foundOnGitHub_line"
  >
    {{ t(l.nothing, { text }) }}
  </p>
</template>

<style lang="scss" module="css">
.foundOnGitHub_head {
  display: flex;
  gap: $spacing-8;
  align-items: baseline;
  padding: $spacing-12 $spacing-12 $spacing-4;
}

.foundOnGitHub_name {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg-2;
}

.foundOnGitHub_detail {
  flex: 1;
  min-width: 0;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.foundOnGitHub_line {
  padding: $spacing-8 $spacing-12 $spacing-8 37px;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}
</style>
