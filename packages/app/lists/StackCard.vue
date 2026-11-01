<!-- The content of a stack's card on a board (D16, SP26, SP27; the board draws the card, its selection and its handlers), as tall as an item's card and no more decorated: on its first line the stack icon — the selection's mark when all its pull requests are selected, a half mark when some are (D20, SP28) — the repository when the list spans several and how many pull requests it holds — "2 of 4" for a share of the stack's open ones, the others in other columns; "1 of 4 matches" under a filter matching some (D3, SP25) — the people on the right and a chevron that expands it; then the stack's name; then the pips — a share's own drawn in their state, the others hollow — and the state in words (worked out as for a list's row, `useStackFacts`). Expanded, it lists its pull requests inside it, first to last, each in its own state with its number and title, the one selected in it highlighted, those the filter does not match de-emphasised; a click opens one. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, ChevronDown, ChevronRight, Layers, Minus } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';

import type { ItemProperty } from './ItemProperty.js';
import type { ListStack } from './ListTypes.js';
import * as l from './StackCard.loc.js';
import StackPips from './StackPips.vue';
import * as facts from './useStackFacts.loc.js';
import { useStackFacts } from './useStackFacts.js';

const props = withDefaults(
  defineProps<{
    stack: ListStack;
    /** What the card shows besides its icon, name, pips and state: only its people. */
    properties: readonly ItemProperty[];
    /** Epoch ms the ages are counted to. */
    now: number;
    /** The repository the whole list is of (`owner/name`): its stacks leave it out. */
    repository?: string | null;
    /** Who the card shows, as `ItemCard`: who opened its pull requests (my work) or who they are assigned to. */
    people?: 'assignees' | 'author';
    /** The signed-in user: with `people: 'author'`, their own pull requests show no face. */
    viewerLogin?: string | null;
    /** All its pull requests are in the selection several items are edited together in (`x`). */
    checked?: boolean;
    /** Some of its pull requests are in that selection, not all (D20, SP28): a half mark. */
    halfChecked?: boolean;
    /** Its pull requests are listed inside it. */
    expanded?: boolean;
    /** The pull request selected in it, highlighted while it is expanded. */
    selectedMember?: string | null;
  }>(),
  { repository: null, people: 'assignees', viewerLogin: null, expanded: false, selectedMember: null },
);

const emit = defineEmits<{
  /** The chevron: expand or collapse it. */
  toggle: [];
  /** One of its pull requests clicked in it, expanded. */
  open: [id: string];
}>();

const t = useTranslate();
const stackFacts = useStackFacts({
  stack: () => props.stack,
  now: () => props.now,
  people: () => props.people,
  viewerLogin: () => props.viewerLogin,
});
const nameWithOwner = computed(() => {
  const name = props.stack.pullRequests[0]?.repository.nameWithOwner ?? null;
  return name === props.repository ? null : name;
});
</script>

<template>
  <div :class="css.stackCard">
    <div :class="css.stackCard_head">
      <Check
        v-if="checked"
        :class="css.stackCard_check"
        role="img"
        :aria-label="t(l.inSelection)"
      />
      <Minus
        v-else-if="halfChecked"
        :class="css.stackCard_check"
        role="img"
        :aria-label="t(l.partlySelected)"
      />
      <Layers
        v-else
        :class="css.stackCard_icon"
        role="img"
        :aria-label="t(l.stack)"
      />
      <span :class="css.stackCard_reference">
        <template v-if="nameWithOwner">{{ nameWithOwner }}</template>
        {{ stackFacts.count }}
      </span>
      <span :class="css.stackCard_people">
        <template v-if="properties.includes('people')">
          <Avatar
            v-for="person in stackFacts.people.faces"
            :key="person.login"
            :name="person.login"
            :src="person.avatarUrl"
            size="xs"
          />
          <span
            v-if="stackFacts.people.more > 0"
            :class="css.stackCard_more"
            >{{ t(facts.more, { count: stackFacts.people.more }) }}</span
          >
        </template>
      </span>
      <!-- Toggling it opens nothing; neither it nor a pull request inside takes the focus, so the board's keys stay. -->
      <button
        type="button"
        tabindex="-1"
        :class="css.stackCard_toggle"
        :aria-expanded="expanded"
        :aria-label="t(expanded ? l.collapse : l.expand)"
        @mousedown.prevent
        @click.stop="emit('toggle')"
      >
        <component
          :is="expanded ? ChevronDown : ChevronRight"
          aria-hidden="true"
        />
      </button>
    </div>
    <span :class="css.stackCard_title">{{ stack.description.name.title }}</span>
    <div :class="css.stackCard_state">
      <StackPips
        :pips="stack.description.pips"
        :filled="stackFacts.filled"
      />
      <span :class="[css.stackCard_sentence, css[`stackCard_tone_${stackFacts.state.tone}`]]">
        <component
          :is="stackFacts.state.icon"
          :class="css.stackCard_stateIcon"
          aria-hidden="true"
        />
        {{ stackFacts.state.text }}
      </span>
    </div>
    <ul
      v-if="expanded"
      :class="css.stackCard_members"
    >
      <li
        v-for="member in stackFacts.members"
        :key="member.pullRequest.id"
      >
        <button
          type="button"
          tabindex="-1"
          :class="[
            css.stackCard_member,
            member.pullRequest.id === selectedMember && css.stackCard_member_selected,
            stack.unmatched?.has(member.pullRequest.id) && css.stackCard_member_unmatched,
          ]"
          :aria-current="member.pullRequest.id === selectedMember ? 'true' : undefined"
          @mousedown.prevent
          @click.stop="emit('open', member.pullRequest.id)"
        >
          <component
            :is="member.icon"
            :class="[css.stackCard_stateIcon, css[`stackCard_tone_${member.tone}`]]"
            aria-hidden="true"
          />
          <span :class="css.stackCard_number">#{{ member.pullRequest.number }}</span>
          <span :class="css.stackCard_memberTitle">{{ member.pullRequest.title }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style lang="scss" module="css">
// The rhythm of `ItemCard`: the same padding, head and title, so a stack's card is as tall as an item's.
.stackCard {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-10 $spacing-12;
  font-size: $font-size-2xs;
  line-height: 16px;
}

.stackCard_head,
.stackCard_state {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
}

.stackCard_icon,
.stackCard_check {
  flex: none;
  width: 13px;
  height: 13px;
}

.stackCard_icon {
  color: $color-fg-2;
}

.stackCard_check {
  padding: 1px;
  color: $color-on-light;
  background: $color-accent;
  border-radius: $radius-sm;
}

.stackCard_reference {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-family-mono;
  color: $color-fg-dim;
  white-space: nowrap;
}

.stackCard_people {
  display: inline-flex;
  flex: none;
  gap: $spacing-2;
  align-items: center;
}

.stackCard_more,
.stackCard_number {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.stackCard_toggle {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  color: $color-fg-3;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg-2;
  }

  svg {
    width: 12px;
    height: 12px;
  }
}

.stackCard_title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-fg;
  -webkit-box-orient: vertical;
}

.stackCard_sentence {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.stackCard_stateIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.stackCard_tone_danger {
  color: $color-red;
}

.stackCard_tone_warning {
  color: $color-amber;
}

.stackCard_tone_success {
  color: $color-green;
}

.stackCard_tone_done {
  color: $color-purple;
}

.stackCard_tone_muted {
  color: $color-fg-2;
}

.stackCard_tone_dim {
  color: $color-fg-dim;
}

.stackCard_members {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-8 0 0;
  margin: 0;
  list-style: none;
  border-top: 1px solid $color-border;
}

.stackCard_member {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: $spacing-2 $spacing-4;
  font: inherit;
  color: $color-fg-2;
  text-align: left;
  cursor: default;
  background: none;
  border: none;
  border-radius: $radius-sm;

  &:hover {
    background: $color-bg-2;
  }
}

.stackCard_member_selected,
.stackCard_member_selected:hover {
  color: $color-fg;
  // On the selected card, which is `$color-sel` too: the accent's edge tells it apart, as a selected row's does.
  background: $color-sel;
  box-shadow: inset 2px 0 0 $color-accent;

  .stackCard_number {
    color: $color-fg-2;
  }
}

.stackCard_member_unmatched {
  opacity: 0.4;
}

.stackCard_memberTitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
