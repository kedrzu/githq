<!-- How a file changed, as one letter (M A D R C) with its word as a tooltip: added green, deleted red, the rest quiet. -->
<script lang="ts">
import type { PatchStatus } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

function getLetter(change: PatchStatus) {
  switch (change) {
    case 'ADDED':
      return 'A';
    case 'DELETED':
      return 'D';
    case 'RENAMED':
      return 'R';
    case 'COPIED':
      return 'C';
    case 'MODIFIED':
    case 'CHANGED':
      return 'M';
    default:
      return assertNever(change);
  }
}
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './Review.loc.js';

defineProps<{
  change: PatchStatus;
}>();

const t = useTranslate();
</script>

<template>
  <span
    :class="[
      css.reviewChange,
      change === 'ADDED' && css.reviewChange_added,
      change === 'DELETED' && css.reviewChange_deleted,
    ]"
    :title="t(l[change])"
    >{{ getLetter(change) }}</span
  >
</template>

<style lang="scss" module="css">
.reviewChange {
  flex: none;
  width: 9px;
  font-family: $font-family-mono;
  font-size: 10.5px;
  color: $color-fg-dim;
}

.reviewChange_added {
  color: $color-green;
}

.reviewChange_deleted {
  color: $color-red;
}
</style>
