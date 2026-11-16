<!-- The content of one row of a list (the list draws the row, its selection and its handlers) of issues and pull requests (D1): the kind and state icon, the title, a pull request's number, the people (who opened it in my work, who it is assigned to elsewhere) and how long ago it changed, each right after the one before — nothing pinned to the far edge, the title giving way first; under them an issue's repository and number, a pull request's repository unless the list or the issue it is nested under already names it, the marker of a pull request listed alone out of its stack (D16, SP13: a stack icon, the stack's pips with its own tall — the stack's other open ones hollow — and its place, "3 of 4"), the pips and state of the stack an issue serves as the header of (stacked PRs D12, SP20, SP21), where a pull request stands — "Checks passed" first when its checks are green and no green status says as much ("Approved · checks passed" says it in one); ready to merge, approved or with no review needed or asked, followed by "Merge" (`⇧M`) where the viewer may merge it, else "Open on GitHub"; "Being merged · not merged yet" until GitHub confirms, the open icon kept (merging D3), then "Merged · 5m"; a merge that did not end merged says how — "Merge refused" or "Not merged · new commit from dkim", followed by "Back to the merge" (`⇧M`) where the viewer may merge it, or grey "Merge sent · outcome not known yet"; GitHub's own "In queue · 3rd · about 12 min" or "Auto-merge on · squash · waiting for checks" (PM37) — its size, the row field of its first project (D12), the milestone, a project's field values (in its view, `fields`) and the labels — those of them the list's display options show. A pull request nested under the issue it closes is indented, its icon smaller, its title as any other; one of a stack with a header of its own under an issue one step further (D23). On a phone (mobile D23) the title wraps to two lines and line two keeps what tells whether to open it: the reference (`webapp#1187` for a repository the list says is tracked, with its owner for another, the number alone where the list names it), the stack's marker or summary, a pull request's standing short as MB89 draws it — its checks as a count ("✓ 12/12", red "✕ 8/9", a spinner and "3/9" while some run), then a word or two ("Review", "Approved", "Ready", "Changes", "Draft", "Auto-merge"…), each said in full to a screen reader — the row field with its colour dot and "+N" for its other projects, the labels as dots (named together for a screen reader), a project's values, and at its end one avatar and the age; size, milestone and the Merge and Open buttons wait in the item, and the field and a project's values give way before the rest. A pull request nested under an issue is one indented line there (mobile D24): an arrow, its number, its title as far as it fits and its checks, whatever its phase, where it has them. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import {
  ArrowUpRight,
  Check,
  CornerDownRight,
  GitMerge,
  ListPlus,
  Milestone,
  SquareKanban,
  Undo2,
} from 'lucide-vue-next';
import { computed } from 'vue';

import { openOnGitHub } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';
import { EDIT_KEYS } from '@/commands/useEditCommands.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import LabelPill from '@/components/LabelPill.vue';
import { MergeContext } from '@/merge/MergeContext.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import type { Item } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { formatAge } from '@/utils/formatAge.js';

import type { ItemProperty } from './ItemProperty.js';
import ItemField from './ItemField.vue';
import * as l from './ItemRow.loc.js';
import ItemStatus from './ItemStatus.vue';
import LabelDots from './LabelDots.vue';
import type { ListStack } from './ListTypes.js';
import PullRequestSize from './PullRequestSize.vue';
import StackMarker from './StackMarker.vue';
import StackSummary from './StackSummary.vue';
import StackToggle from './StackToggle.vue';
import { useItemFacts } from './useItemFacts.js';
import type { ItemShortFact } from './useItemFacts.js';
import { getPhoneRepositoryName } from './utils/getPhoneRepositoryName.js';

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
    /** Its repository is tracked: a phone's row names it without its owner (mobile D23). */
    repositoryTracked?: boolean;
    /** Nested two steps in: a pull request of a stack with a header of its own under an issue (D23). */
    deep?: boolean;
    /** The stack this issue serves as the header of (`ListRow.stacks`, D12): its pips and state, and its chevron. */
    header?: ListStack | null;
    /** The stack it is the header of is listed under it: its chevron points down. */
    expanded?: boolean;
    /** The item opened over the list: a pull request of the stack the row is the header of has its pip tall (D14). */
    openedId?: string | null;
    /** In the selection several items are edited together in (`x`). */
    checked?: boolean;
    /** An edit of it GitHub just refused, said for a moment ("“regression” label undone"). */
    undone?: string | null;
    /** The stack this pull request is listed alone out of (`ListRow.stackMarker`), for its marker. */
    stack?: StackDescription | null;
    /** Says how long its draft review has waited, rather than when it last changed (the draft reviews, CR34). */
    draftAge?: boolean;
  }>(),
  {
    people: 'author',
    reviewRequested: false,
    repository: null,
    parent: null,
    repositoryTracked: false,
    deep: false,
    header: null,
    expanded: false,
    openedId: null,
    undone: null,
    stack: null,
  },
);

const emit = defineEmits<{
  /** The chevron of the stack it is the header of was clicked: the list expands or collapses it, opening nothing. */
  toggle: [];
}>();

defineSlots<{
  /** Before the labels: a project's field values, in a project's view. */
  fields?(): unknown;
}>();

const t = useTranslate();
const phone = useService(PhoneLayout);
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
/** The viewer may merge it: when it is ready, "Merge" follows instead of "Open on GitHub". */
const mergeable = computed(() => merging?.canOpen(props.item.id) === true);
const onQueueBranch = computed(() => props.item.kind === 'pullRequest' && props.item.isMergeQueueEnabled);
/** D21: an open draft is marked whatever the list shows; the rest of the status and the merge buttons follow the option. */
const hasDraft = computed(() => props.item.kind === 'pullRequest' && props.item.pendingReview !== null);
const waitingDraft = computed(() =>
  props.draftAge && props.item.kind === 'pullRequest' ? props.item.pendingReview : null,
);
const age = computed(() =>
  waitingDraft.value
    ? t(l.draftAge, { age: formatAge(Date.parse(waitingDraft.value.createdAt), props.now) })
    : facts.age,
);
/** Mobile D23: `webapp#1187` for a tracked repository, `owner/name#1187` for another, `#1187` where the list names it. */
const phoneReference = computed(() => {
  const { repository } = facts;
  if (repository === null) {
    return facts.number;
  }

  return `${getPhoneRepositoryName(repository, props.repositoryTracked)}${facts.number}`;
});
/**
 * Mobile D23, MB89: where a pull request stands, short — its checks as a count ("✓ 12/12", "✕ 8/9"), then its review or
 * merge in a word or two ("Review", "Approved", "Draft") — each said in full to a screen reader. A list showing no
 * status still marks a draft review (D21).
 */
const phoneFacts = computed((): readonly ItemShortFact[] => {
  const short = facts.status?.short ?? [];
  if (shown.value.has('status')) {
    return facts.shortChecks ? [facts.shortChecks, ...short] : short;
  }

  return facts.status?.draftReview ? short : [];
});
/** Mobile D24: a nested line's one fact, its checks whatever its phase; nothing without them. */
const nestedFact = computed(() => (shown.value.has('status') ? facts.checksCount : null));
</script>

<template>
  <!-- Mobile D24: under the issue it closes, one line — an arrow, its number, as much of its title as fits, its checks. -->
  <div
    v-if="phone.active && parent"
    :class="[css.itemRow, css.itemRow_phoneNested, deep && css.itemRow_phoneDeep]"
  >
    <CornerDownRight
      :class="css.itemRow_arrow"
      aria-hidden="true"
    />
    <Check
      v-if="checked"
      :class="[css.itemRow_check, css.itemRow_check_small]"
      role="img"
      :aria-label="t(l.inSelection)"
    />
    <component
      :is="facts.kind.icon"
      v-else
      :class="[css.itemRow_kind, css.itemRow_kind_small, css[`itemRow_kind_${facts.kind.tone}`]]"
      role="img"
      :aria-label="facts.kind.label"
    />
    <span :class="css.itemRow_phoneNumber">{{ phoneReference }}</span>
    <span :class="css.itemRow_phoneNestedTitle">{{ item.title }}</span>
    <span
      v-if="nestedFact"
      :class="css.itemRow_shared"
      role="img"
      :aria-label="nestedFact.label"
      :title="nestedFact.label"
    >
      <ItemStatus :status="nestedFact" />
    </span>
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
  <!-- Mobile D23: the title on up to two lines; under it what tells whether to open it, one avatar and the age. -->
  <div
    v-else-if="phone.active"
    :class="[css.itemRow, css.itemRow_phone]"
  >
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
      <div :class="[css.itemRow_line, css.itemRow_phoneTitleLine]">
        <span :class="css.itemRow_phoneTitle">{{ item.title }}</span>
        <StackToggle
          v-if="header"
          :expanded="expanded"
          @toggle="emit('toggle')"
        />
      </div>
      <div :class="css.itemRow_line">
        <!-- The key facts first; the field, the dots and a project's values give way at the end. -->
        <span :class="css.itemRow_facts">
          <span :class="css.itemRow_reference">{{ phoneReference }}</span>
          <StackMarker
            :class="css.itemRow_stack"
            :item="item"
            :stack="stack"
          />
          <StackSummary
            v-if="header"
            :stack="header"
            :now="now"
            :viewer-login="viewerLogin"
            :opened-id="openedId"
          />
          <span
            v-for="phoneFact in phoneFacts"
            :key="phoneFact.text"
            :class="css.itemRow_shared"
            role="img"
            :aria-label="phoneFact.label"
            :title="phoneFact.label"
          >
            <ItemStatus :status="phoneFact" />
          </span>
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
          <ItemField
            v-if="facts.projectField && shown.has('projectField')"
            :class="css.itemRow_phoneField"
            :icon="SquareKanban"
            :color="facts.projectField.color"
            :value="facts.projectField.value"
            :more="facts.projectField.more"
            :title="facts.projectField.title"
          />
          <LabelDots
            v-if="shown.has('labels')"
            :labels="item.labels"
          />
          <span :class="css.itemRow_phoneValues"><slot name="fields" /></span>
        </span>
        <span :class="css.itemRow_aside">
          <Avatar
            v-if="shown.has('people') && facts.people[0]"
            :name="facts.people[0].login"
            :src="facts.people[0].avatarUrl"
            size="sm"
          />
          <time
            v-if="shown.has('updated')"
            :class="css.itemRow_age"
            :datetime="waitingDraft?.createdAt ?? item.updatedAt"
            >{{ age }}</time
          >
        </span>
      </div>
    </div>
  </div>
  <div
    v-else
    :class="[css.itemRow, parent && css.itemRow_nested, deep && css.itemRow_deep]"
  >
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
        <span :class="css.itemRow_name">
          <span :class="css.itemRow_title">{{ item.title }}</span>
          <StackToggle
            v-if="header"
            :expanded="expanded"
            @toggle="emit('toggle')"
          />
        </span>
        <span
          v-if="item.kind === 'pullRequest'"
          :class="css.itemRow_number"
          >{{ facts.number }}</span
        >
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
          :datetime="waitingDraft?.createdAt ?? item.updatedAt"
          >{{ age }}</time
        >
      </div>
      <div :class="css.itemRow_line">
        <span
          v-if="item.kind !== 'pullRequest'"
          :class="css.itemRow_reference"
          >{{ facts.reference }}</span
        >
        <span
          v-else-if="facts.repository"
          :class="css.itemRow_reference"
          >{{ facts.repository }}</span
        >
        <StackMarker
          :class="css.itemRow_stack"
          :item="item"
          :stack="stack"
        />
        <StackSummary
          v-if="header"
          :stack="header"
          :now="now"
          :viewer-login="viewerLogin"
          :opened-id="openedId"
        />
        <ItemStatus
          v-if="facts.checks && shown.has('status')"
          :class="css.itemRow_shared"
          :status="facts.checks"
        />
        <ItemStatus
          v-if="facts.status && (shown.has('status') || hasDraft)"
          :class="css.itemRow_shared"
          :status="facts.status"
        />
        <!-- Neither merging it nor opening it is opening the row. -->
        <Button
          v-if="facts.status?.backToMerge && shown.has('status') && mergeable"
          variant="link"
          size="sm"
          :icon="GitMerge"
          :kbd="EDIT_KEYS.merge"
          :keyshortcuts="EDIT_KEYS.merge"
          @click.stop="merging?.open(item.id)"
        >
          {{ t(l.backToMerge) }}
        </Button>
        <Button
          v-else-if="facts.status?.readyToMerge && shown.has('status') && mergeable"
          variant="link"
          size="sm"
          :icon="onQueueBranch ? ListPlus : GitMerge"
          :kbd="EDIT_KEYS.merge"
          :keyshortcuts="EDIT_KEYS.merge"
          @click.stop="merging?.open(item.id)"
        >
          {{ onQueueBranch ? t(l.addToQueue) : t(l.merge) }}
        </Button>
        <Button
          v-else-if="facts.status?.readyToMerge && shown.has('status')"
          variant="link"
          size="sm"
          :link="item.url"
          :icon="ArrowUpRight"
          :kbd="keyOf(openOnGitHub)"
          target="_blank"
          :keyshortcuts="keyOf(openOnGitHub)"
          @click.stop
        >
          {{ t(openOnGitHub.title) }}
        </Button>
        <PullRequestSize
          v-if="facts.size && shown.has('size')"
          :additions="facts.size.additions"
          :deletions="facts.size.deletions"
        />
        <ItemField
          v-if="facts.projectField && shown.has('projectField')"
          :class="css.itemRow_shared"
          :icon="SquareKanban"
          :value="facts.projectField.value"
          :more="facts.projectField.more"
          :title="facts.projectField.title"
        />
        <ItemField
          v-if="item.milestone && shown.has('milestone')"
          :class="css.itemRow_shared"
          :icon="Milestone"
          :value="item.milestone.title"
        />
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
// Inside the list's row (`ListView`): its 2px by 8px inset, then 8px into the surface its selection lights up.
.itemRow {
  display: flex;
  gap: $spacing-10;
  padding: $spacing-10 $spacing-16;
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

  &.itemRow_check_small {
    width: 13px;
    height: 13px;
    margin-top: 0;
  }

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
}

.itemRow_kind {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: $spacing-2;

  .itemRow_nested &,
  &.itemRow_kind_small {
    width: 13px;
    height: 13px;
  }

  @include item-kind-tones;
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

// No spacer: what follows the title sits right after it, the title giving way first when the row is narrow.
.itemRow_name {
  display: flex;
  gap: $spacing-8;
  min-width: 0;
}

.itemRow_title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
  line-height: 18px;
  color: $color-fg;
}

.itemRow_number {
  flex: none;
  font-size: $font-size-row-title;
  font-weight: $font-weight-normal;
  line-height: 18px;
  color: $color-fg-2;
}

.itemRow_age {
  flex: none;
  color: $color-fg-dim;
}

.itemRow_reference {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.itemRow_stack {
  display: inline-flex;
  flex: none;
}

.itemRow_shared {
  flex: none;
}

.itemRow_statusIcon {
  width: 12.5px;
  height: 12.5px;
}

// Mobile D23, D24: the phone's row.
.itemRow_phone {
  padding: $spacing-10 $spacing-16;
}

.itemRow_phoneTitleLine {
  align-items: flex-start;
  white-space: normal;
}

.itemRow_phoneTitle {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: $font-size-row-title;
  font-weight: $font-weight-medium;
  line-height: 18px;
  color: $color-fg;
  -webkit-box-orient: vertical;
}

.itemRow_facts {
  display: flex;
  flex: 1;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

// Gives way before the status, keeping its dot and "+N" the longest.
.itemRow_phoneField {
  flex: 0 1000 auto;
  min-width: 40px;
}

// A project's values come last and give way first, never squeezing what comes before them.
.itemRow_phoneValues {
  display: flex;
  flex: 0 100000 auto;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.itemRow_aside {
  display: inline-flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  margin-left: auto;
}

.itemRow_phoneNested {
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-4 $spacing-16 $spacing-8 26px;
  font-size: $font-size-2xs;
  line-height: 16px;
  white-space: nowrap;
}

.itemRow_phoneDeep {
  padding-left: 50px;
}

.itemRow_arrow {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-dim;
}

.itemRow_phoneNumber {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.itemRow_phoneNestedTitle {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-2;
}
</style>
