<!-- Choosing the repository of a new issue (H2), in place of the quick capture's chips: type part of its name, ↑/↓, Enter. The repositories come in sections — those of the project it was started in, the tracked ones, then any other the user can create issues in (GitHub searched as they type) — and those that won't take an issue (archived, issues turned off) are listed with why, not chosen. Escape goes back to the title. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { BookMarked, Lock, Search } from 'lucide-vue-next';
import type { AcceptableValue } from 'reka-ui';
import { computed } from 'vue';

import FilterList from '@/components/FilterList.vue';
import type { FilterListGroup, FilterListRow } from '@/components/FilterList.vue';
import Kbd from '@/components/Kbd.vue';

import * as l from './RepositoryChooser.loc.js';

/** A section of the list. */
export interface RepositoryChoiceSection {
  readonly key: string;
  readonly heading: string;
  readonly choices: readonly RepositoryChoice[];
}

/** A repository offered. */
export interface RepositoryChoice {
  /** `owner/name`. */
  readonly nameWithOwner: string;
  readonly isPrivate: boolean;
  /** Dim text after the name ("private · 96 open", "last used"). */
  readonly detail?: string;
  /** Why it won't take an issue; it can't be chosen. */
  readonly unavailable?: string;
}

/** A line of the list. */
interface ChoiceRow extends FilterListRow {
  readonly choice: RepositoryChoice;
}

const props = defineProps<{
  sections: readonly RepositoryChoiceSection[];
  /** GitHub is being searched for what was typed. */
  searching: boolean;
}>();

const emit = defineEmits<{
  choose: [nameWithOwner: string];
  /** Escape: back to the title. */
  back: [];
}>();

const query = defineModel<string>('query', { required: true });

const t = useTranslate();

const groups = computed(() =>
  props.sections.map((section): FilterListGroup<ChoiceRow> => ({
    key: section.key,
    heading: section.heading,
    rows: section.choices.map(choice => ({
      value: choice.nameWithOwner,
      disabled: choice.unavailable !== undefined,
      choice,
    })),
  })),
);
const message = computed(() => {
  if (props.searching) {
    return t(l.searching);
  }

  const available = props.sections.some(section => section.choices.some(choice => !choice.unavailable));
  return available ? null : t(l.noMatch);
});

function choose(value: AcceptableValue | AcceptableValue[]) {
  if (typeof value === 'string') {
    emit('choose', value);
  }
}
</script>

<template>
  <FilterList
    v-model:query="query"
    :model-value="null"
    :label="t(l.label)"
    :groups="groups"
    :placeholder="t(l.placeholder)"
    :filter-label="t(l.label)"
    :message="message"
    :hints="[
      { keys: 'Enter', label: t(l.choose) },
      { keys: 'Escape', label: t(l.back) },
    ]"
    back-on-escape
    @update:model-value="choose"
    @back="emit('back')"
  >
    <template #beforeFilter>
      <Search
        :class="css.repositoryChooser_searchIcon"
        aria-hidden="true"
      />
    </template>
    <template #row="{ row, highlighted }">
      <component
        :is="row.choice.isPrivate ? Lock : BookMarked"
        :class="css.repositoryChooser_icon"
        aria-hidden="true"
      />
      <span :class="css.repositoryChooser_name">{{ row.choice.nameWithOwner }}</span>
      <span
        v-if="row.choice.detail"
        :class="css.repositoryChooser_detail"
        >{{ row.choice.detail }}</span
      >
      <span :class="css.repositoryChooser_spacer" />
      <span
        v-if="row.choice.unavailable"
        :class="css.repositoryChooser_detail"
        >{{ row.choice.unavailable }}</span
      >
      <Kbd
        v-else-if="highlighted"
        keys="Enter"
      />
    </template>
  </FilterList>
</template>

<style lang="scss" module="css">
.repositoryChooser_searchIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-dim;
}

.repositoryChooser_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-2;
}

.repositoryChooser_name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repositoryChooser_detail {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.repositoryChooser_spacer {
  flex: 1;
}
</style>
