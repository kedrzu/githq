<!-- What "my work" narrowed from the sidebar to one group says when that group is in and shows nothing: a filtered-out note, as the rest of "my work" may hold plenty (first run and loading D6, D15, ES12). It says what is shown and offers the rest, counted once every group is in, as a partial total would read as the whole (D14). When the group has items and it is the filter that hides them, the note names the filter and clears it (ES11). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { AtSign } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import FilteredOut from '@/components/FilteredOut.vue';
import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';

import type { MyWorkCounts, MyWorkFilter } from './buildMyWork.js';
import * as l from './MyWorkGroupEmpty.loc.js';
import * as groupLabels from './MyWorkGroupLabel.loc.js';
import * as filterLabels from './MyWorkView.loc.js';

const SAYS = {
  reviewRequested: { title: l.reviewRequestedTitle, detail: l.reviewRequestedDetail },
  authored: { title: l.authoredTitle, detail: l.authoredDetail },
  assigned: { title: l.assignedTitle, detail: l.assignedDetail },
  mentioned: { title: l.mentionedTitle, detail: l.mentionedDetail },
};

const props = defineProps<{
  group: MyWorkGroup;
  filter: MyWorkFilter;
  /** What "my work" holds under no filter. */
  counts: MyWorkCounts;
  /** Every group of "my work" has arrived, so `counts` is the whole of it. */
  allArrived: boolean;
}>();

const emit = defineEmits<{
  /** "Clear filter": the group stays. */
  clearFilter: [];
  /** "Show all of My work": all four groups, unfiltered. */
  showAll: [];
}>();

const t = useTranslate();

const hiddenByFilter = computed(() => props.filter !== 'all' && props.counts[props.group] > 0);
const others = computed(() => props.counts.total - props.counts[props.group]);
/** Offered while others may still arrive too: the group's own emptiness says nothing about them. */
const offersRest = computed(() => !props.allArrived || others.value > 0);
const emptyDetail = computed(() => {
  const own = t(SAYS[props.group].detail);
  return props.allArrived && others.value > 0 ? `${own} ${t(l.others, { count: others.value })}` : own;
});
</script>

<template>
  <FilteredOut
    v-if="hiddenByFilter"
    place="screen"
    :detail="t(l.hides, { filter: t(filterLabels[filter]), count: counts[group], group: t(groupLabels[group]) })"
    :clear="() => emit('clearFilter')"
  />
  <FilteredOut
    v-else
    place="screen"
    :icon="group === 'mentioned' ? AtSign : undefined"
    :title="t(SAYS[group].title)"
    :detail="emptyDetail"
  >
    <template
      v-if="offersRest"
      #action
    >
      <Button
        variant="secondary"
        @click="emit('showAll')"
      >
        {{ t(l.showAll) }}
      </Button>
    </template>
  </FilteredOut>
</template>
