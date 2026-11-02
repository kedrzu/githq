<!-- A tracked project's row in Settings' Projects (T17 `L5sxR`, selected `jbKD6`): its title and `#number`, where its items come from as the local copy holds them — a tracked project brings its items even from repositories that aren't tracked, so with several it says how many of them are — how many items it holds, how it stands, and Untrack (`TrackedRow`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { SquareKanban } from 'lucide-vue-next';
import { computed } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import * as l from './TrackedProjectRow.loc.js';
import TrackedRow from './TrackedRow.vue';
import type { TrackedStatus } from './TrackingTypes.js';

const props = defineProps<{
  title: string;
  number: number;
  /** Its items in the local copy, archived ones left out. */
  itemCount: number;
  /** The repositories its issues and pull requests come from, `owner/name`. */
  repositories: readonly string[];
  /** How many of {@link repositories} are tracked. */
  trackedRepositories: number;
  status: TrackedStatus;
  /** What "synced 14s ago" is counted from. */
  now: number;
  selected?: boolean;
}>();

const emit = defineEmits<{
  untrack: [];
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

// Nothing held yet: nothing to tell.
const source = computed(() => {
  const [only] = props.repositories;
  if (props.repositories.length > 1) {
    return t(l.fromSeveral, {
      count: numbers.format(props.repositories.length),
      tracked: numbers.format(props.trackedRepositories),
    });
  }

  if (only !== undefined) {
    return t(l.fromOne, { name: only });
  }

  return props.itemCount > 0 ? t(l.draftsOnly) : undefined;
});
</script>

<template>
  <TrackedRow
    :icon="SquareKanban"
    :title="title"
    :number="number"
    :source="source"
    :count="t(l.items, { count: itemCount, formatted: numbers.format(itemCount) })"
    :status="status"
    :now="now"
    :selected="selected"
    @untrack="emit('untrack')"
  />
</template>
