<!-- What a screen says when there is data but the filter, state or view on screen hides all of it (first run and loading D6, D8, `Empty / Filtered out · screen`): a funnel, or what the narrowed view stands for (ES12's at-sign), what it hides, and a way to clear it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { FunnelX } from 'lucide-vue-next';

import Button from './Button.vue';
import EmptyState from './EmptyState.vue';
import * as l from './FilteredOut.loc.js';

defineProps<{
  /** What the screen says; "Filtered down to zero" when not given. */
  title?: string;
  /** What the filter hides: "Label is bug hides all 18 open issues." */
  detail?: string;
  /** A technical fact in a mono chip. */
  fact?: string;
  /** A funnel when not given. */
  icon?: LucideIcon;
  /** Clears the filter: "Clear filter" is drawn when given and the `action` slot is not. */
  clear?: () => unknown;
}>();

defineSlots<{
  /** A way on in place of "Clear filter": "Show all items". */
  action?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <EmptyState
    place="screen"
    :icon="icon ?? FunnelX"
    :title="title ?? t(l.filteredDownToZero)"
    :detail="detail"
    :fact="fact"
  >
    <template
      v-if="$slots.action || clear"
      #action
    >
      <slot name="action">
        <Button
          variant="secondary"
          size="sm"
          :icon="FunnelX"
          @click="clear"
        >
          {{ t(l.clearFilter) }}
        </Button>
      </slot>
    </template>
  </EmptyState>
</template>
