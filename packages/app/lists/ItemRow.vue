<!-- The content of one row of a list (the list draws the row, its selection and its handlers) of issues and pull requests (D1): the kind and state icon, the title, the people (who opened it in my work, who it is assigned to elsewhere) and how long ago it changed; under them the repository and number, the marker of a pull request listed alone out of its stack (D16, SP13: a stack icon, the stack's pips with its own tall — the stack's other open ones hollow — and its place, "3 of 4"), the pips and state of the stack an issue serves as the header of (stacked PRs D12, SP20, SP21), where a pull request stands, its size, the row field of its first project (D12), the milestone, a project's field values (in its view, `fields`) and the labels — those of them the list's display options show. A pull request nested under the issue it closes is indented and quieter; one of a stack with a header of its own under an issue one step further (D23). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, Check, Layers, Milestone, SquareKanban, Undo2 } from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import LabelPill from '@/components/LabelPill.vue';
import type { Item } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';

import type { ItemProperty } from './ItemProperty.js';
import * as l from './ItemRow.loc.js';
import type { ListStack } from './ListTypes.js';
import StackPips from './StackPips.vue';
import StackSummary from './StackSummary.vue';
import { useItemFacts } from './useItemFacts.js';

const props = withDefaults(
  defineProps<{
    item: Item;
    /** What the row shows besides its kind, title and number. */
    properties: readonly ItemProperty[];
    /** The signed-in user: their own items show no author. */
    viewerLogin: string;
    /** Epoch ms the ages are counted to. */
    now: number;
    /** Who the row shows: who opened it (my work) or who it is assigned to. */
    people?: 'assignees' | 'author';
    /** Listed because the user's review is asked: an open pull request with nothing else to say says so. */
    reviewRequested?: boolean;
    /** The repository the whole list is of (`owner/name`): its items are named by number alone. */
    repository?: string | null;
    /** The issue this pull request is nested under; its number alone names it when they share a repository. */
    parent?: Item | null;
    /** Nested two steps in: a pull request of a stack with a header of its own under an issue (D23). */
    deep?: boolean;
    /** The stack this issue serves as the header of (`ListRow.stacks`, D12): its pips and state. */
    header?: ListStack | null;
    /** In the selection several items are edited together in (`x`). */
    checked?: boolean;
    /** An edit of it GitHub just refused, said for a moment ("“regression” label undone"). */
    undone?: string | null;
    /** The stack this pull request is listed alone out of (`ListRow.stackMarker`), for its marker. */
    stack?: StackDescription | null;
  }>(),
  {
    people: 'author',
    reviewRequested: false,
    repository: null,
    parent: null,
    deep: false,
    header: null,
    undone: null,
    stack: null,
  },
);

defineSlots<{
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
</script>

<template>
  <div :class="[css.itemRow, parent && css.itemRow_nested, deep && css.itemRow_deep]">
    <Check
      v-if="checked"
      :class="css.itemRow_check"
      role="img"
      :aria-label="t(l.inSelection)"
    />
    <component
      :is="facts.kind.icon"
      v-else
      :class="[css.itemRow_kind, css[`itemRow_kind_${facts.kind.tone}`]]"
      role="img"
      :aria-label="facts.kind.label"
    />
    <div :class="css.itemRow_content">
      <div :class="css.itemRow_line">
        <span :class="css.itemRow_title">{{ item.title }}</span>
        <template v-if="shown.has('people')">
          <Avatar
            v-for="person in facts.people"
            :key="person.login"
            :name="person.login"
            :src="person.avatarUrl"
            size="xs"
          />
        </template>
        <time
          v-if="shown.has('updated')"
          :class="css.itemRow_age"
          :datetime="item.updatedAt"
          >{{ facts.age }}</time
        >
      </div>
      <div :class="css.itemRow_line">
        <span :class="css.itemRow_reference">{{ facts.reference }}</span>
        <span
          v-if="marker"
          :class="css.itemRow_stack"
        >
          <Layers
            :class="css.itemRow_stackIcon"
            role="img"
            :aria-label="t(l.inStack)"
          />
          <StackPips
            :pips="marker.pips"
            :filled="marker.filled"
            :current="item.id"
          />
          <span :class="css.itemRow_stackPlace">{{ marker.place }}</span>
        </span>
        <StackSummary
          v-if="header"
          :stack="header"
          :now="now"
          :viewer-login="viewerLogin"
        />
        <span
          v-if="facts.status && shown.has('status')"
          :class="[css.itemRow_status, css[`itemRow_status_${facts.status.tone}`]]"
        >
          <component
            :is="facts.status.icon"
            :class="css.itemRow_statusIcon"
            aria-hidden="true"
          />
          <span :class="css.itemRow_statusText">{{ facts.status.text }}</span>
        </span>
        <!-- Opening it is not selecting the row. -->
        <Button
          v-if="facts.status?.openOnGitHub && shown.has('status')"
          variant="link"
          size="sm"
          :link="item.url"
          :icon="ArrowUpRight"
          kbd="O"
          target="_blank"
          aria-keyshortcuts="O"
          @click.stop
        >
          {{ t(l.openOnGitHub) }}
        </Button>
        <span
          v-if="facts.size && shown.has('size')"
          :class="css.itemRow_size"
          >{{ facts.size }}</span
        >
        <span
          v-if="facts.projectField && shown.has('projectField')"
          :class="css.itemRow_field"
          :title="facts.projectField.title"
        >
          <SquareKanban
            :class="css.itemRow_fieldIcon"
            aria-hidden="true"
          />
          {{ facts.projectField.value }}
          <span
            v-if="facts.projectField.more"
            :class="css.itemRow_fieldMore"
            >{{ facts.projectField.more }}</span
          >
        </span>
        <span
          v-if="item.milestone && shown.has('milestone')"
          :class="css.itemRow_field"
        >
          <Milestone
            :class="css.itemRow_fieldIcon"
            aria-hidden="true"
          />
          {{ item.milestone.title }}
        </span>
        <slot name="fields" />
        <LabelPill
          v-for="label in shown.has('labels') ? item.labels : []"
          :key="label.name"
          :name="label.name"
          :color="label.color"
        />
        <span
          v-if="undone"
          :class="css.itemRow_undone"
          role="status"
        >
          <Undo2
            :class="css.itemRow_statusIcon"
            aria-hidden="true"
          />
          {{ undone }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="css">
.itemRow {
  display: flex;
  gap: $spacing-10;
  padding: $spacing-7 $spacing-16;
}

.itemRow_nested {
  padding-left: 42px;
}

.itemRow_deep {
  padding-left: 66px;
}

.itemRow_check {
  flex: none;
  width: 15px;
  height: 15px;
  padding: $spacing-2;
  margin-top: $spacing-2;
  color: $color-on-light;
  background: $color-accent;
  border-radius: $radius-sm;
}

.itemRow_undone {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  padding: 1px 7px;
  color: $color-red;
  background: rgba($color-red, 0.1);
  border-radius: 9px;
}

.itemRow_kind {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: $spacing-2;

  .itemRow_nested & {
    width: 13px;
    height: 13px;
  }
}

.itemRow_kind_open {
  color: $color-green;
}

.itemRow_kind_done {
  color: $color-purple;
}

.itemRow_kind_closed {
  color: $color-red;
}

.itemRow_kind_draft {
  color: $color-fg-dim;
}

.itemRow_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-5;
  min-width: 0;
}

.itemRow_line {
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

.itemRow_title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
  line-height: 18px;
  color: $color-fg;

  .itemRow_nested & {
    font-size: $font-size-sm;
    font-weight: $font-weight-normal;
    color: $color-fg-2;
  }
}

.itemRow_age {
  flex: none;
  color: $color-fg-dim;
}

.itemRow_reference,
.itemRow_size {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.itemRow_stack {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
}

.itemRow_stackIcon {
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.itemRow_stackPlace {
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.itemRow_status {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
}

.itemRow_statusText {
  display: inline-block;

  &::first-letter {
    text-transform: uppercase;
  }
}

.itemRow_status_danger {
  color: $color-red;
}

.itemRow_status_warning {
  color: $color-amber;
}

.itemRow_status_success {
  color: $color-green;
}

.itemRow_status_muted {
  color: $color-fg-2;
}

.itemRow_status_dim {
  color: $color-fg-dim;
}

.itemRow_statusIcon {
  width: 12.5px;
  height: 12.5px;
}

.itemRow_field {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  color: $color-fg-2;
}

.itemRow_fieldIcon {
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}

.itemRow_fieldMore {
  font-family: $font-family-mono;
  font-size: 11px;
  color: $color-fg-dim;
}
</style>
