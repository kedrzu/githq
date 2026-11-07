<!-- What a screen, a list's group or a board column says when there is data but the filter, state or view on screen hides all of it (first run and loading D6, D8, `Empty / Filtered out · screen | group | column`): a funnel, or what the narrowed view stands for (ES12's at-sign), the filter named, and a way to clear it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { FunnelX } from 'lucide-vue-next';

import Button from './Button.vue';
import EmptyState from './EmptyState.vue';
import * as l from './FilteredOut.loc.js';

defineProps<{
  place: 'screen' | 'group' | 'column';
  /** The filter as the toolbar writes it (`label:bug`): a group's or a column's line names it. */
  filter?: string;
  /** What the screen says; "Nothing matches this filter" on a screen, "Nothing matches {filter}" elsewhere. */
  title?: string;
  /** On a screen, what the filter hides: "Label is bug hides all 18 open issues." */
  detail?: string;
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
    :place="place"
    :icon="icon ?? FunnelX"
    :title="
      title ?? (place === 'screen' || filter == null ? t(l.nothingMatchesThisFilter) : t(l.nothingMatches, { filter }))
    "
    :detail="detail"
  >
    <template
      v-if="$slots.action || clear"
      #action
    >
      <slot name="action">
        <Button
          :variant="place === 'screen' ? 'secondary' : 'outline'"
          :size="place === 'screen' ? 'md' : 'sm'"
          @click="clear"
        >
          {{ t(l.clearFilter) }}
        </Button>
      </slot>
    </template>
  </EmptyState>
</template>
