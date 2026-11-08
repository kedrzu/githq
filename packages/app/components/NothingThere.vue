<!-- What a screen, a list's group or a board column says when the data is complete and holds nothing (first run and loading D6, D8, `Empty / Nothing there · screen | group | column`): on a screen the centred note, quiet grey or green when it is good news; in a group or a column a plain "Nothing here.", the header saying what it is. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { Inbox } from 'lucide-vue-next';

import EmptyState from './EmptyState.vue';
import * as l from './NothingThere.loc.js';

withDefaults(
  defineProps<{
    place: 'screen' | 'group' | 'column';
    /** What the screen says ("No issues"); "Nothing here." when not given. */
    title?: string;
    /** On a screen, what was checked, so "nothing" can be trusted. */
    detail?: string;
    /** On a screen; an inbox when not given. */
    icon?: LucideIcon;
    /** `good` when nothing is good news ("Nothing on your plate"). */
    tone?: 'muted' | 'good';
  }>(),
  { title: undefined, detail: undefined, icon: undefined, tone: 'muted' },
);

defineSlots<{
  /** A way on: a `Button` to where there is something. */
  action?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <EmptyState
    :place="place"
    :icon="place === 'screen' ? (icon ?? Inbox) : undefined"
    :tone="tone"
    :title="title ?? t(l.nothingHere)"
    :detail="detail"
  >
    <template
      v-if="$slots.action"
      #action
    >
      <slot name="action" />
    </template>
  </EmptyState>
</template>
