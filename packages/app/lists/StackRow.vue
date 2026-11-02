<!-- The content of a stack's entry in a list (D14, SP10; the list draws the row, its chevron, its selection and its handlers): two lines like an item's row. The stack icon (the selection's mark when all its pull requests are selected, a half mark when some are: D20, SP28), its name and how many pull requests it holds (no number of its own; "1 of 4 matches" under a filter matching some: D3, SP25), the people assigned to any of them (in my work, who opened them, the user left out) — up to three faces and "+N" — and how long ago the latest changed; under them the repository when the list spans several, the pips — one per pull request in order, each in its own state (D5, D6), all pale while the copy is incomplete and all amber when it needs a rebase, the one opened over the list tall (D14) — and the state in words, naming what holds it (SP14); an entry holding a share of the stack's open pull requests, the others in other groups (D16, SP24), reads "2 of 4", draws the others' pips hollow and says how the share stands — "Both ready", "#1206 blocks" — where the stack's sentence is about its readiness. Then as far as the list's display options show them what its pull requests share (D15): their size summed, the labels all of them carry with "+N" for the rest, the row field of their first project when shared, else "+N", the milestone when shared, else how many, a project's field values as its owner gives them (`fields`). What it says is worked out as for a board's card (`useStackFacts`, `StackCard`). Nested under an issue (my work, one of two stacks closing it: D23, SP22) it is indented and quieter, without the repository the issue shares. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, Layers, Milestone, Minus, SquareKanban } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import LabelPill from '@/components/LabelPill.vue';
import type { Item } from '@/store/ItemTypes.js';

import type { ItemProperty } from './ItemProperty.js';
import type { ListStack } from './ListTypes.js';
import * as l from './StackRow.loc.js';
import StackState from './StackState.vue';
import { useStackFacts } from './useStackFacts.js';

const props = withDefaults(
  defineProps<{
    stack: ListStack;
    /** What the row shows besides its icon, name, pips and state. */
    properties: readonly ItemProperty[];
    /** Epoch ms the age is counted to. */
    now: number;
    /** The repository the whole list is of (`owner/name`): its stacks leave it out. */
    repository?: string | null;
    /** The issue the entry is nested under (D23); its repository is left out when they share it. */
    parent?: Item | null;
    /** Who the entry shows, as `ItemRow`: who opened its pull requests (my work) or who they are assigned to. */
    people?: 'assignees' | 'author';
    /** The signed-in user: with `people: 'author'`, their own pull requests show no face. */
    viewerLogin?: string | null;
    /** All its pull requests are in the selection several items are edited together in (`x`). */
    checked?: boolean;
    /** Some of its pull requests are in that selection, not all (D20, SP28): a half mark. */
    halfChecked?: boolean;
    /** The item opened over the list: when one of its pull requests, its pip is tall (D14). */
    openedId?: string | null;
  }>(),
  { repository: null, parent: null, people: 'assignees', viewerLogin: null, openedId: null },
);

defineSlots<{
  /** In a project's view, the values of its fields its pull requests share (D15), as `ItemRow`'s. */
  fields?(): unknown;
}>();

const t = useTranslate();
const stackFacts = useStackFacts({
  stack: () => props.stack,
  now: () => props.now,
  people: () => props.people,
  viewerLogin: () => props.viewerLogin,
});

const shown = computed(() => new Set(props.properties));
const description = computed(() => props.stack.description);
const nameWithOwner = computed(() => {
  const name = props.stack.pullRequests[0]?.repository.nameWithOwner ?? null;
  return name === props.repository || name === props.parent?.repository.nameWithOwner ? null : name;
});
</script>

<template>
  <div :class="[css.stackRow, parent && css.stackRow_nested]">
    <Check
      v-if="checked"
      :class="css.stackRow_check"
      role="img"
      :aria-label="t(l.inSelection)"
    />
    <Minus
      v-else-if="halfChecked"
      :class="css.stackRow_check"
      role="img"
      :aria-label="t(l.partlySelected)"
    />
    <Layers
      v-else
      :class="css.stackRow_icon"
      role="img"
      :aria-label="t(l.stack)"
    />
    <div :class="css.stackRow_content">
      <div :class="css.stackRow_line">
        <span :class="css.stackRow_name">
          <span :class="css.stackRow_title">{{ description.name.title }}</span>
          <span :class="css.stackRow_count">{{ stackFacts.count }}</span>
        </span>
        <template v-if="shown.has('people')">
          <Avatar
            v-for="person in stackFacts.people.faces"
            :key="person.login"
            :name="person.login"
            :src="person.avatarUrl"
            size="xs"
          />
          <span
            v-if="stackFacts.people.more"
            :class="css.stackRow_more"
            >{{ stackFacts.people.more }}</span
          >
        </template>
        <time
          v-if="shown.has('updated')"
          :class="css.stackRow_age"
          :datetime="description.updatedAt"
          >{{ stackFacts.age }}</time
        >
      </div>
      <div :class="css.stackRow_line">
        <span
          v-if="nameWithOwner"
          :class="css.stackRow_repository"
          >{{ nameWithOwner }}</span
        >
        <StackState
          :pips="description.pips"
          :filled="stackFacts.filled"
          :current="openedId"
          :state="stackFacts.state"
        />
        <span
          v-if="shown.has('size')"
          :class="css.stackRow_size"
          >{{ stackFacts.size }}</span
        >
        <span
          v-if="stackFacts.projectField && shown.has('projectField')"
          :class="css.stackRow_field"
          :title="stackFacts.projectField.title"
        >
          <SquareKanban
            :class="css.stackRow_fieldIcon"
            aria-hidden="true"
          />
          {{ stackFacts.projectField.value }}
          <span
            v-if="stackFacts.projectField.more"
            :class="css.stackRow_more"
            >{{ stackFacts.projectField.more }}</span
          >
        </span>
        <span
          v-if="stackFacts.milestone && shown.has('milestone')"
          :class="css.stackRow_field"
        >
          <Milestone
            :class="css.stackRow_fieldIcon"
            aria-hidden="true"
          />
          {{ stackFacts.milestone }}
        </span>
        <slot name="fields" />
        <template v-if="shown.has('labels')">
          <LabelPill
            v-for="label in stackFacts.labels.shared"
            :key="label.name"
            :name="label.name"
            :color="label.color"
          />
          <span
            v-if="stackFacts.labels.more"
            :class="css.stackRow_more"
            >{{ stackFacts.labels.more }}</span
          >
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
// The rhythm of `ItemRow`: the same padding, icon and lines, so an entry sits among rows unnoticed but for its pips.
.stackRow {
  display: flex;
  gap: $spacing-10;
  padding: $spacing-7 $spacing-16;
}

.stackRow_nested {
  padding-left: 42px;
}

.stackRow_icon,
.stackRow_check {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: $spacing-2;
}

.stackRow_icon {
  color: $color-fg-2;
}

.stackRow_check {
  padding: $spacing-2;
  color: $color-on-light;
  background: $color-accent;
  border-radius: $radius-sm;
}

.stackRow_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-5;
  min-width: 0;
}

.stackRow_line {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-2xs;
  line-height: 16px;
  white-space: nowrap;

  &:first-child {
    gap: $spacing-8;
  }
}

.stackRow_name {
  display: flex;
  flex: 1;
  gap: $spacing-8;
  align-items: baseline;
  min-width: 0;
}

.stackRow_title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
  line-height: 18px;
  color: $color-fg;

  .stackRow_nested & {
    font-size: $font-size-sm;
  }
}

.stackRow_count,
.stackRow_repository,
.stackRow_size,
.stackRow_more {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.stackRow_age {
  flex: none;
  color: $color-fg-dim;
}

.stackRow_field {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  color: $color-fg-2;
}

.stackRow_fieldIcon {
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}
</style>
