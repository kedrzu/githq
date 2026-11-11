<!-- The content of one card of a board (D5, J2): the kind and state icon with the repository and number, the people on the right; the title; for a pull request listed alone out of its stack, its marker (D16, SP26: a stack icon, the stack's pips with its own tall — the stack's other open ones hollow — and its place, "1 of 3"); under it where a pull request stands — "Checks passed" first when its checks are green and no green status says as much, how its last merge ended when it did not merge too (PM37) — its size, the row field of its first project (D12), the milestone, a project's field values (in its view, `fields`), the labels and how long ago it changed — those of them the list's display options show. The board draws the card, its selection and its handlers. A pull request nested under the issue it closes (my work) is a smaller card under it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { Check, Milestone, SquareKanban, Undo2 } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import LabelPill from '@/components/LabelPill.vue';
import { MergeContext } from '@/merge/MergeContext.js';
import type { Item } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';

import * as l from './ItemCard.loc.js';
import ItemField from './ItemField.vue';
import type { ItemProperty } from './ItemProperty.js';
import ItemStatus from './ItemStatus.vue';
import PullRequestSize from './PullRequestSize.vue';
import StackMarker from './StackMarker.vue';
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
const merging = injectContext(MergeContext, { optional: true });
const facts = useItemFacts({
  item: () => props.item,
  parent: () => props.parent,
  repository: () => props.repository,
  viewerLogin: () => props.viewerLogin,
  now: () => props.now,
  reviewRequested: () => props.reviewRequested,
  people: () => props.people,
  mergeRecord: () => merging?.getRecord(props.item.id) ?? null,
});
const shown = computed(() => new Set(props.properties));
/** D21: an open draft is marked whatever the board shows. */
const hasDraft = computed(() => props.item.kind === 'pullRequest' && props.item.pendingReview !== null);
const status = computed(() => (shown.value.has('status') || hasDraft.value ? facts.status : null));
const checks = computed(() => (shown.value.has('status') ? facts.checks : null));
const size = computed(() => (shown.value.has('size') ? facts.size : null));
const projectField = computed(() => (shown.value.has('projectField') ? facts.projectField : null));
const milestone = computed(() => (shown.value.has('milestone') ? props.item.milestone : null));
const labels = computed(() => (shown.value.has('labels') ? props.item.labels : []));
const hasFooter = computed(
  () =>
    status.value !== null ||
    checks.value !== null ||
    size.value !== null ||
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
    <StackMarker
      :class="css.itemCard_stack"
      :item="item"
      :stack="stack"
    />
    <div
      v-if="hasFooter"
      :class="css.itemCard_footer"
    >
      <ItemStatus
        v-if="checks"
        :class="css.itemCard_shared"
        :status="checks"
      />
      <ItemStatus
        v-if="status"
        :class="css.itemCard_shared"
        :status="status"
      />
      <PullRequestSize
        v-if="size"
        :additions="size.additions"
        :deletions="size.deletions"
      />
      <ItemField
        v-if="projectField"
        :class="css.itemCard_shared"
        :icon="SquareKanban"
        :value="projectField.value"
        :more="projectField.more"
        :title="projectField.title"
      />
      <ItemField
        v-if="milestone"
        :class="css.itemCard_shared"
        :icon="Milestone"
        :value="milestone.title"
      />
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

.itemCard_kind {
  @include item-kind-tones;
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

.itemCard_shared {
  min-width: 0;
}

.itemCard_undone {
  min-width: 0;
  display: inline-flex;
  gap: 5px;
  align-items: center;
  color: $color-red;
}

.itemCard_icon {
  flex: none;
  width: 12px;
  height: 12px;
}

.itemCard_age {
  margin-left: auto;
  color: $color-fg-dim;
}
</style>
