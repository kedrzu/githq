<!-- The content of a stack's entry in a list (D14, SP10; the list draws the row, its chevron, its selection and its handlers): two lines like an item's row. The stack icon, its name and how many pull requests it holds (no number of its own), the people assigned to any of them (in my work, who opened them, the user left out) — up to three faces and "+N" — and how long ago the latest changed; under them the repository when the list spans several, the pips — one per pull request in order, each in its own state (D5, D6), all pale while the copy is incomplete and all amber when it needs a rebase — and the state in words, naming what holds it (SP14), then as far as the list's display options show them what its pull requests share (D15): their size summed, the labels all of them carry with "+N" for the rest, the row field of their first project when shared, else "+N", the milestone when shared, else how many, a project's field values as its owner gives them (`fields`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  Eye,
  GitCompareArrows,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Hourglass,
  Layers,
  Loader,
  Milestone,
  SquareKanban,
} from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import LabelPill from '@/components/LabelPill.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemLabel, ItemUser } from '@/store/ItemTypes.js';
import type { StackBlocker, StackDescription, StackPullRequestPipKind } from '@/store/stacks/describeStack.js';
import { formatAge } from '@/utils/formatAge.js';

import type { ItemProperty } from './ItemProperty.js';
import type { ListStack } from './ListTypes.js';
import * as l from './StackRow.loc.js';
import { getItemPeople } from './utils/getItemPeople.js';

/** The faces shown before "+N" (D15). */
const MAX_PEOPLE = 3;
/** Beyond this many pull requests the pips narrow (D14). */
const MAX_WIDE_PIPS = 12;

const props = withDefaults(
  defineProps<{
    stack: ListStack;
    /** What the row shows besides its icon, name, pips and state. */
    properties: readonly ItemProperty[];
    /** Epoch ms the age is counted to. */
    now: number;
    /** The repository the whole list is of (`owner/name`): its stacks leave it out. */
    repository?: string | null;
    /** Who the entry shows, as `ItemRow`: who opened its pull requests (my work) or who they are assigned to. */
    people?: 'assignees' | 'author';
    /** The signed-in user: with `people: 'author'`, their own pull requests show no face. */
    viewerLogin?: string | null;
    /** All its pull requests are in the selection several items are edited together in (`x`). */
    checked?: boolean;
  }>(),
  { repository: null, people: 'assignees', viewerLogin: null },
);

/** The state in words, its icon and colour (SP14). */
interface StackStateFact {
  readonly icon: LucideIcon;
  readonly tone: 'danger' | 'dim' | 'done' | 'muted' | 'success' | 'warning';
  readonly text: string;
}

/** The row field of its pull requests' first project (githq D12) as the entry shows it (D15). */
interface StackProjectFieldFact {
  /** The value all of them share; `null` when they differ: "+N" alone. */
  readonly value: string | null;
  readonly title: string;
  readonly more: string | null;
}

/** What the held sentence counts and names. */
interface HeldTextParams {
  readonly ready: number;
  readonly open: number;
  readonly number: number;
}

defineSlots<{
  /** In a project's view, the values of its fields its pull requests share (D15), as `ItemRow`'s. */
  fields?(): unknown;
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const fieldList = new Intl.ListFormat(APP_LANGUAGE);

const shown = computed(() => new Set(props.properties));
const description = computed(() => props.stack.description);
const nameWithOwner = computed(() => props.stack.pullRequests[0]?.repository.nameWithOwner ?? null);
const count = computed(() => {
  const { held, size } = description.value;
  return description.value.state.kind === 'incomplete' ? t(l.inGithq, { held, size }) : String(size);
});
const people = computed(() => {
  const byLogin = new Map<string, ItemUser>();
  for (const pr of props.stack.pullRequests) {
    for (const user of getItemPeople({ item: pr, shown: props.people, viewerLogin: props.viewerLogin })) {
      byLogin.set(user.login, user);
    }
  }

  const all = [...byLogin.values()];
  return { faces: all.slice(0, MAX_PEOPLE), more: all.length - MAX_PEOPLE };
});
const age = computed(() => formatAge(Date.parse(description.value.updatedAt), props.now));
const stateFact = computed(() => getStateFact(description.value));
const size = computed(() => {
  let additions = 0;
  let deletions = 0;
  for (const pr of props.stack.pullRequests) {
    additions += pr.additions;
    deletions += pr.deletions;
  }

  return t(l.size, { additions: numbers.format(additions), deletions: numbers.format(deletions) });
});
// D15: the labels every pull request carries, then how many others any of them does.
const labels = computed(() => {
  const [first, ...others] = props.stack.pullRequests;
  const shared: ItemLabel[] = (first?.labels ?? []).filter(label =>
    others.every(pr => pr.labels.some(other => other.name === label.name)),
  );
  const names = new Set(props.stack.pullRequests.flatMap(pr => pr.labels.map(label => label.name)));
  return { shared, more: names.size - shared.length };
});
// D15: the milestone when all share it, else how many there are among them.
const milestone = computed(() => {
  const titles = new Set<string>();
  for (const pr of props.stack.pullRequests) {
    if (pr.milestone) {
      titles.add(pr.milestone.title);
    }
  }

  const [title] = titles;
  if (titles.size > 1) {
    return t(l.milestones, { count: titles.size });
  }

  return title !== undefined && props.stack.pullRequests.every(pr => pr.milestone) ? title : null;
});
// D15, as labels: the row field of the first project (githq D12) when every pull request has the same, else how many
// values there are among them.
const projectField = computed((): StackProjectFieldFact | null => {
  const values = new Map<string, string>();
  for (const pr of props.stack.pullRequests) {
    const [first] = pr.projects;
    if (first?.status) {
      const title = t(l.projectField, { project: first.title, value: first.status.name });
      values.set(title, first.status.name);
    }
  }

  const [shared] = values;
  if (!shared) {
    return null;
  }

  const [title, value] = shared;
  if (values.size === 1 && props.stack.pullRequests.every(pr => pr.projects[0]?.status)) {
    return { value, title, more: null };
  }

  return { value: null, title: fieldList.format(values.keys()), more: t(l.more, { count: values.size }) };
});
const narrow = computed(() => description.value.pips.length > MAX_WIDE_PIPS);

function getStateFact(stack: StackDescription): StackStateFact {
  const fact = getOpenStateFact(stack);
  const { state } = stack;
  const open = state.kind !== 'merged' && state.kind !== 'closed' && state.kind !== 'incomplete';
  return open && stack.landed > 0 ? { ...fact, text: t(l.landed, { count: stack.landed, state: fact.text }) } : fact;
}

function getOpenStateFact({ state }: StackDescription): StackStateFact {
  switch (state.kind) {
    case 'ready':
      return { icon: CircleCheck, tone: 'success', text: t(l.ready, { count: state.openCount }) };
    case 'held': {
      const { blocker, readyCount, openCount } = state;
      const params = { ready: readyCount, open: openCount, number: blocker.number };
      return { ...getBlockerLook(blocker.kind), text: getHeldText(blocker, params) };
    }
    case 'needsRebase':
      return { icon: GitCompareArrows, tone: 'warning', text: t(l.needsRebase) };
    case 'closedInside':
      return {
        icon: GitPullRequestClosed,
        tone: 'danger',
        text: t(l.closedInside, { number: state.closedNumber, stuck: state.stuckCount }),
      };
    case 'closed':
      return { icon: GitPullRequestClosed, tone: 'dim', text: t(l.closed) };
    case 'incomplete':
      return { icon: CircleDashed, tone: 'dim', text: t(l.incomplete) };
    case 'merged':
      return { icon: GitMerge, tone: 'done', text: t(l.merged) };
    case 'reviewRequested':
      return {
        icon: Eye,
        tone: 'muted',
        text: t(l.reviewRequested, {
          requested: state.requestedCount,
          open: state.openCount,
          ready: state.readyCount,
        }),
      };
    default:
      return assertNever(state);
  }
}

/** The held sentence names what holds the stack (SP14): "#1216 checks running", "#97 waiting for review". */
function getHeldText(blocker: StackBlocker, params: HeldTextParams): string {
  switch (blocker.kind) {
    case 'draft':
      return t(l.heldByDraft, params);
    case 'moving':
      return t(l.heldByChecks, params);
    case 'waiting':
      return blocker.waitingForReview ? t(l.heldByReview, params) : t(l.held, params);
    case 'broken':
    case 'ready':
    case 'merged':
    case 'closed':
      return t(l.held, params);
    default:
      return assertNever(blocker.kind);
  }
}

/** A held stack reads in the colour of what holds it (SP14): red when broken, amber when moving, grey otherwise. */
function getBlockerLook(kind: StackPullRequestPipKind): Pick<StackStateFact, 'icon' | 'tone'> {
  switch (kind) {
    case 'broken':
      return { icon: CircleX, tone: 'danger' };
    case 'moving':
      return { icon: Loader, tone: 'warning' };
    case 'draft':
      return { icon: GitPullRequestDraft, tone: 'dim' };
    case 'waiting':
    case 'ready':
    case 'merged':
    case 'closed':
      return { icon: Hourglass, tone: 'muted' };
    default:
      return assertNever(kind);
  }
}
</script>

<template>
  <div :class="css.stackRow">
    <Check
      v-if="checked"
      :class="css.stackRow_check"
      role="img"
      :aria-label="t(l.inSelection)"
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
          <span :class="css.stackRow_count">{{ count }}</span>
        </span>
        <template v-if="shown.has('people')">
          <Avatar
            v-for="person in people.faces"
            :key="person.login"
            :name="person.login"
            :src="person.avatarUrl"
            size="xs"
          />
          <span
            v-if="people.more > 0"
            :class="css.stackRow_more"
            >{{ t(l.more, { count: people.more }) }}</span
          >
        </template>
        <time
          v-if="shown.has('updated')"
          :class="css.stackRow_age"
          :datetime="description.updatedAt"
          >{{ age }}</time
        >
      </div>
      <div :class="css.stackRow_line">
        <span
          v-if="nameWithOwner && nameWithOwner !== repository"
          :class="css.stackRow_repository"
          >{{ nameWithOwner }}</span
        >
        <!-- The sentence beside them says how the stack stands. -->
        <span
          :class="[css.stackRow_pips, narrow && css.stackRow_pips_narrow]"
          aria-hidden="true"
        >
          <span
            v-for="(pip, index) in description.pips"
            :key="index"
            :class="[css.stackRow_pip, css[`stackRow_pip_${pip.kind}`]]"
          />
        </span>
        <span :class="[css.stackRow_state, css[`stackRow_state_${stateFact.tone}`]]">
          <component
            :is="stateFact.icon"
            :class="css.stackRow_stateIcon"
            aria-hidden="true"
          />
          {{ stateFact.text }}
        </span>
        <span
          v-if="shown.has('size')"
          :class="css.stackRow_size"
          >{{ size }}</span
        >
        <span
          v-if="projectField && shown.has('projectField')"
          :class="css.stackRow_field"
          :title="projectField.title"
        >
          <SquareKanban
            :class="css.stackRow_fieldIcon"
            aria-hidden="true"
          />
          {{ projectField.value }}
          <span
            v-if="projectField.more"
            :class="css.stackRow_more"
            >{{ projectField.more }}</span
          >
        </span>
        <span
          v-if="milestone && shown.has('milestone')"
          :class="css.stackRow_field"
        >
          <Milestone
            :class="css.stackRow_fieldIcon"
            aria-hidden="true"
          />
          {{ milestone }}
        </span>
        <slot name="fields" />
        <template v-if="shown.has('labels')">
          <LabelPill
            v-for="label in labels.shared"
            :key="label.name"
            :name="label.name"
            :color="label.color"
          />
          <span
            v-if="labels.more > 0"
            :class="css.stackRow_more"
            >{{ t(l.more, { count: labels.more }) }}</span
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

.stackRow_pips {
  display: inline-flex;
  flex: none;
  gap: $spacing-2;
  align-items: center;
}

.stackRow_pip {
  box-sizing: border-box;
  width: 8px;
  height: 4px;
  border: 1px solid transparent;
  border-radius: 2px;

  .stackRow_pips_narrow & {
    width: 4px;
  }
}

.stackRow_pip_merged {
  background: $color-purple;
}

.stackRow_pip_ready {
  background: $color-green;
}

.stackRow_pip_broken {
  background: $color-red;
}

.stackRow_pip_moving {
  background: $color-amber;
}

.stackRow_pip_waiting {
  background: $color-fg-3;
}

.stackRow_pip_draft {
  border-color: $color-fg-3;
}

.stackRow_pip_closed {
  border-color: $color-red;
}

.stackRow_pip_missing {
  border-color: $color-border-2;
}

.stackRow_state {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
}

.stackRow_state_danger {
  color: $color-red;
}

.stackRow_state_warning {
  color: $color-amber;
}

.stackRow_state_success {
  color: $color-green;
}

.stackRow_state_done {
  color: $color-purple;
}

.stackRow_state_muted {
  color: $color-fg-2;
}

.stackRow_state_dim {
  color: $color-fg-dim;
}

.stackRow_stateIcon {
  width: 12.5px;
  height: 12.5px;
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
