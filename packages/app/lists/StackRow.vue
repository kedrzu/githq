<!-- The content of a stack's entry in a list (D14, SP10; the list draws the row, its chevron, its selection and its handlers): two lines like an item's row. The stack icon, its name and how many pull requests it holds (no number of its own), the people assigned to any of them — up to three faces and "+N" — and how long ago the latest changed; under them the repository when the list spans several, the pips — one per pull request in order, each in its own state (D5, D6) — and the state in words (SP14), then as far as the list's display options show them what its pull requests share (D15): their size summed, the labels all of them carry with "+N" for the rest, the milestone when shared, else how many. -->
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
} from 'lucide-vue-next';
import { computed } from 'vue';

import Avatar from '@/components/Avatar.vue';
import LabelPill from '@/components/LabelPill.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemLabel, ItemUser } from '@/store/ItemTypes.js';
import type { StackDescription, StackPullRequestPipKind } from '@/store/stacks/describeStack.js';
import { formatAge } from '@/utils/formatAge.js';

import type { ItemProperty } from './ItemProperty.js';
import type { ListStack } from './ListTypes.js';
import * as l from './StackRow.loc.js';
import * as factTexts from './useItemFacts.loc.js';

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
    /** All its pull requests are in the selection several items are edited together in (`x`). */
    checked?: boolean;
  }>(),
  { repository: null },
);

/** The state in words, its icon and colour (SP14). */
interface StackStateFact {
  readonly icon: LucideIcon;
  readonly tone: 'danger' | 'dim' | 'done' | 'muted' | 'success' | 'warning';
  readonly text: string;
}

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);

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
    for (const user of pr.assignees) {
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

  return t(factTexts.size, { additions: numbers.format(additions), deletions: numbers.format(deletions) });
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
      return {
        ...getBlockerLook(blocker.kind),
        text: blocker.kind === 'draft' ? t(l.heldByDraft, params) : t(l.held, params),
      };
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
          v-if="milestone && shown.has('milestone')"
          :class="css.stackRow_field"
        >
          <Milestone
            :class="css.stackRow_fieldIcon"
            aria-hidden="true"
          />
          {{ milestone }}
        </span>
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
  padding: 7px $spacing-16;
}

.stackRow_icon,
.stackRow_check {
  flex: none;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}

.stackRow_icon {
  color: $color-fg-2;
}

.stackRow_check {
  padding: 2px;
  color: $color-on-light;
  background: $color-accent;
  border-radius: $radius-sm;
}

.stackRow_content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
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
  font-size: 13.5px;
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
  gap: 2px;
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
  gap: 5px;
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
  gap: 5px;
  align-items: center;
  color: $color-fg-2;
}

.stackRow_fieldIcon {
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}
</style>
