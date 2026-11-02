<!-- A tracked repository's row in Settings' Repositories (G8 `CqvD4`, selected `Dht0d`): its name without the owner (the group names it), public or private — no tag while nothing tells — how many of its items are open, how it stands, and Untrack (`TrackedRow`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookMarked, Lock } from 'lucide-vue-next';
import { computed } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import * as l from './TrackedRepositoryRow.loc.js';
import TrackedRow from './TrackedRow.vue';
import type { TrackedStatus } from './TrackingTypes.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  /** `null` while nothing tells: no tag. */
  isPrivate: boolean | null;
  /** Its open items in the local copy (`TrackedItems.getOpenCount`). */
  openCount: number;
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

const badge = computed(() => {
  if (props.isPrivate === null) {
    return undefined;
  }

  return t(props.isPrivate ? l.private : l.public);
});
</script>

<template>
  <TrackedRow
    :icon="isPrivate ? Lock : BookMarked"
    :title="parseRepositoryName(nameWithOwner).name"
    :badge="badge"
    :count="t(l.open, { count: numbers.format(openCount) })"
    :status="status"
    :now="now"
    :selected="selected"
    @untrack="emit('untrack')"
  />
</template>
