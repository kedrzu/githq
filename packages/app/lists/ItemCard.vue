<!-- The content of one card of a board (D5, J2): the kind and state icon with the repository and number, the people on the right; the title; for a pull request listed alone out of its stack, its marker (D16, SP26: a stack icon, the stack's pips with its own tall — the stack's other open ones hollow — and its place, "1 of 3"); under it where a pull request stands, the row field of its first project (D12), the milestone, a project's field values (in its view, `fields`), the labels and how long ago it changed — those of them the list's display options show. The board draws the card, its selection and its handlers. A pull request nested under the issue it closes (my work) is a smaller card under it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, Layers, Milestone, SquareKanban, Undo2 } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import LabelPill from '@/components/LabelPill.vue';
import type { Item } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';

import * as l from './ItemCard.loc.js';
import type { ItemProperty } from './ItemProperty.js';
import StackPips from './StackPips.vue';
import { useItemFacts } from './useItemFacts.js';

const props = withDefaults(
  defineProps<{
    item: Item;
    /** What the card shows besides its kind, title and number. */
    properties: readonly ItemProperty[];
    /** The signed-in user: their own items show no author. */
    viewerLogin: string;
    /** Epoch ms the ages are counted to. */
    now: number;
    /** Who the card shows: who opened it (my work) or who it is assigned to. */
    people?: 'assignees' | 'author';
    /** Listed because the user's review is asked: an open pull request with nothing else to say says so. */
    reviewRequested?: boolean;
    /** The repository the whole list is of (`owner/name`): its items are named by number alone. */
    repository?: string | null;
    /** The issue this pull request is nested under; its number alone names it when they share a repository. */
    parent?: Item | null;
    /** In the selection several items are edited together in (`x`). */
    checked?: boolean;
    /** An edit of it GitHub just refused, said for a moment ("“regression” label undone"). */
    undone?: string | null;
    /** The stack this pull request is listed alone out of (`ListRow.stackMarker`), for its marker. */
    stack?: StackDescription | null;
  }>(),
  { people: 'author', reviewRequested: false, repository: null, parent: null, undone: null, stack: null },
);

const slots = defineSlots<{
  /** Before the labels: a project's field values, in a project's view. */
  fields?(): unknown;
}>();

const t = useTranslate();
const facts = useItemFacts({
  item: () => props.item,
  parent: () => props.parent,
  repository: () => props.repository,
  viewerLogin: () => props.viewerLogin,
  now: () => props.now,
  reviewRequested: () => props.reviewRequested,
  people: () => props.people,
});
const shown = computed(() => new Set(props.properties));
const status = computed(() => (shown.value.has('status') ? facts.status : null));
const projectField = computed(() => (shown.value.has('projectField') ? facts.projectField : null));
const milestone = computed(() => (shown.value.has('milestone') ? props.item.milestone : null));
const labels = computed(() => (shown.value.has('labels') ? props.item.labels : []));
/** The marker's pull request alone in its state, the stack's other open ones hollow (SP24), and its place (SP13). */
const marker = computed(() => {
  const { item, stack } = props;
  if (!stack || item.kind !== 'pullRequest' || !item.stack) {
    return null;
  }

  return {
    pips: stack.pips,
    filled: new Set([item.id]),
    place: t(l.stackPlace, { position: item.stack.position, size: stack.size }),
  };
});
const hasFooter = computed(
  () =>
    status.value !== null ||
    projectField.value !== null ||
    milestone.value !== null ||
    labels.value.length > 0 ||
    shown.value.has('updated') ||
    !!slots.fields ||
    !!props.undone,
);
</script>

<template>
  <div :class="[css.itemCard, parent && css.itemCard_nested]">
    <div :class="css.itemCard_head">
      <Check
        v-if="checked"
        :class="css.itemCard_check"
        role="img"
        :aria-label="t(l.inSelection)"
      />
      <component
        :is="facts.kind.icon"
        v-else
        :class="[css.itemCard_kind, css[`itemCard_kind_${facts.kind.tone}`]]"
        role="img"
        :aria-label="facts.kind.label"
      />
      <span :class="css.itemCard_reference">{{ facts.reference }}</span>
      <span :class="css.itemCard_people">
        <template v-if="shown.has('people')">
          <Avatar
            v-for="person in facts.people"
            :key="person.login"
            :name="person.login"
            :src="person.avatarUrl"
            size="xs"
          />
        </template>
      </span>
    </div>
    <span :class="css.itemCard_title">{{ item.title }}</span>
    <div
      v-if="marker"
      :class="css.itemCard_stack"
    >
      <Layers
        :class="css.itemCard_stackIcon"
        role="img"
        :aria-label="t(l.inStack)"
      />
      <StackPips
        :pips="marker.pips"
        :filled="marker.filled"
        :current="item.id"
      />
      <span :class="css.itemCard_stackPlace">{{ marker.place }}</span>
    </div>
    <div
      v-if="hasFooter"
      :class="css.itemCard_footer"
    >
      <span
        v-if="status"
        :class="[css.itemCard_status, css[`itemCard_status_${status.tone}`]]"
      >
        <component
          :is="status.icon"
          :class="css.itemCard_icon"
          aria-hidden="true"
        />
        <span :class="css.itemCard_statusText">{{ status.text }}</span>
      </span>
      <span
        v-if="projectField"
        :class="css.itemCard_field"
        :title="projectField.title"
      >
        <SquareKanban
          :class="css.itemCard_icon"
          aria-hidden="true"
        />
        {{ projectField.value }}
        <span
          v-if="projectField.more"
          :class="css.itemCard_more"
          >{{ projectField.more }}</span
        >
      </span>
      <span
        v-if="milestone"
        :class="css.itemCard_field"
      >
        <Milestone
          :class="css.itemCard_icon"
          aria-hidden="true"
        />
        {{ milestone.title }}
      </span>
      <slot name="fields" />
      <LabelPill
        v-for="label in labels"
        :key="label.name"
        :name="label.name"
        :color="label.color"
      />
      <span
        v-if="undone"
        :class="css.itemCard_undone"
        role="status"
      >
        <Undo2
          :class="css.itemCard_icon"
          aria-hidden="true"
        />
        {{ undone }}
      </span>
      <time
        v-if="shown.has('updated')"
        :class="css.itemCard_age"
        :datetime="item.updatedAt"
        >{{ facts.age }}</time
      >
    </div>
  </div>
</template>

<style lang="scss" module="css">
.itemCard {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-10 $spacing-12;
  font-size: $font-size-2xs;
  line-height: 16px;
}

.itemCard_nested {
  gap: $spacing-6;
  padding: $spacing-8 $spacing-10;
}

.itemCard_head,
.itemCard_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
}

.itemCard_footer {
  flex-wrap: wrap;
  row-gap: $spacing-6;
}

.itemCard_kind,
.itemCard_check {
  flex: none;
  width: 13px;
  height: 13px;
}

.itemCard_check {
  padding: 1px;
  color: $color-on-light;
  background: $color-accent;
  border-radius: $radius-sm;
}

.itemCard_kind_open {
  color: $color-green;
}

.itemCard_kind_done {
  color: $color-purple;
}

.itemCard_kind_closed {
  color: $color-red;
}

.itemCard_kind_draft {
  color: $color-fg-dim;
}

.itemCard_reference {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-family-mono;
  color: $color-fg-dim;
  white-space: nowrap;
}

.itemCard_stack {
  display: flex;
  gap: $spacing-5;
  align-items: center;
}

.itemCard_stackIcon {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.itemCard_stackPlace {
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.itemCard_people {
  display: inline-flex;
  flex: none;
  gap: $spacing-2;
}

.itemCard_title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-fg;
  -webkit-box-orient: vertical;

  .itemCard_nested & {
    -webkit-line-clamp: 2;
    font-size: $font-size-sm;
    color: $color-fg-2;
  }
}

.itemCard_status,
.itemCard_field,
.itemCard_undone {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-width: 0;
}

.itemCard_statusText {
  display: inline-block;

  &::first-letter {
    text-transform: uppercase;
  }
}

.itemCard_status_danger,
.itemCard_undone {
  color: $color-red;
}

.itemCard_status_warning {
  color: $color-amber;
}

.itemCard_status_success {
  color: $color-green;
}

.itemCard_status_muted,
.itemCard_field {
  color: $color-fg-2;
}

.itemCard_status_dim {
  color: $color-fg-dim;
}

.itemCard_icon {
  flex: none;
  width: 12px;
  height: 12px;
}

.itemCard_field .itemCard_icon {
  color: $color-fg-3;
}

.itemCard_more {
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
}

.itemCard_age {
  margin-left: auto;
  color: $color-fg-dim;
}
</style>
