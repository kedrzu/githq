<!-- The pull requests of a stack in its merge panel, first to last (stacked PRs D11, D18; SP40–SP62): each with its number, title and what it says now — its own state, staying open below the line, held by an earlier one, its checks running again after earlier ones landed (SP58), being merged, in a merge queue (SP54) — those going marked as landing, the line after the last of them with `↑` `↓` beside it ("Stops here", or "Can go up to here" where the next one holds the rest, SP45), later ones dimmed; places the copy does not hold yet in one row each run (SP50). -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Ellipsis, GitMerge, Loader, LoaderCircle } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import Kbd from '@/components/Kbd.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import StackTone from '@/lists/StackTone.vue';
import type { StackLook } from '@/lists/useStackFacts.js';
import { getPullRequestKind } from '@/lists/utils/getPullRequestKind.js';
import { getStackRowText } from '@/lists/utils/getStackRowText.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackPullRequestPipKind } from '@/store/stacks/describeStack.js';

import { useMergeQueueTexts } from '../useMergeQueueTexts.js';

import * as l from './StackMergeMembers.loc.js';
import type { StackMergeRow, StackMergeRowState } from './StackMergeTypes.js';

const props = defineProps<{
  rows: readonly StackMergeRow[];
  /** The line after the last one going: `stops` where it was put, `held` at the last that can land; `null` for none. */
  line: 'held' | 'stops' | null;
}>();

/** A row's state drawn with its pull request's own icon, in words alone: the others have an icon of their own. */
type WordedState = Exclude<StackMergeRowState, { readonly kind: 'freshChecks' | 'merging' }>;

/** A row as drawn: its pull request, its icon, and its state in words. */
interface DrawnRow {
  readonly key: string;
  /** `null` for places the copy does not hold yet. */
  readonly pullRequest: PullRequestItem | null;
  readonly going: boolean;
  readonly dimmed: boolean;
  readonly icon: LucideIcon;
  readonly iconTone: StackLook['tone'] | 'closed' | 'draft' | 'open';
  /** Being merged (SP56): the spinning icon says it, the text is for screen readers alone. */
  readonly spin: boolean;
  readonly text: string;
  readonly tone: StackLook['tone'];
  /** The line is drawn after it. */
  readonly lineAfter: boolean;
}

/** A row's state in words, in their tone. */
interface DrawnWords {
  readonly text: string;
  readonly tone: StackLook['tone'];
}

const t = useTranslate();
const queueTexts = useMergeQueueTexts();

const lastGoing = computed(() => props.rows.findLastIndex(row => row.kind === 'pullRequest' && row.going));
const drawn = computed(() => props.rows.map((row, index) => draw(row, index)));

function draw(row: StackMergeRow, index: number): DrawnRow {
  const lineAfter = props.line !== null && index === lastGoing.value;
  if (row.kind === 'missing') {
    return {
      key: `missing-${index}`,
      pullRequest: null,
      going: false,
      dimmed: false,
      icon: Ellipsis,
      iconTone: 'dim',
      spin: false,
      text: t(l.missing, { count: row.count }),
      tone: 'dim',
      lineAfter,
    };
  }

  const { pullRequest, state, going, dimmed } = row;
  const base = { key: pullRequest.id, pullRequest, going, dimmed, lineAfter };
  switch (state.kind) {
    case 'merging':
      return {
        ...base,
        icon: LoaderCircle,
        iconTone: 'warning',
        spin: true,
        text: getStackRowText({ kind: 'merging', pullRequest, lang: APP_LANGUAGE }),
        tone: 'warning',
      };
    // Nothing lands while they run: no mark of landing (SP58).
    case 'freshChecks':
      return {
        ...base,
        going: false,
        icon: Loader,
        iconTone: 'warning',
        spin: false,
        text: t(l.freshChecks),
        tone: 'warning',
      };
    default: {
      const look = getPullRequestKind(pullRequest);
      const { text, tone } = describe(state, pullRequest);
      return { ...base, icon: look.icon, iconTone: look.tone, spin: false, text, tone };
    }
  }
}

function describe(state: WordedState, pr: PullRequestItem): DrawnWords {
  switch (state.kind) {
    case 'own':
      return {
        text: getStackRowText({ kind: state.pip, pullRequest: pr, lang: APP_LANGUAGE }),
        tone: getOwnTone(state.pip),
      };
    case 'staysOpen':
      return { text: t(l.staysOpen), tone: 'dim' };
    case 'blocked':
      return { text: t(l.blocked), tone: 'dim' };
    case 'heldBy':
      return { text: t(l.heldBy, { number: state.number }), tone: 'dim' };
    // Each one has a position of its own, as GitHub holds it (stacked PRs D11).
    case 'queued':
      return { text: queueTexts.summary(state.entry), tone: 'dim' };
    default:
      return assertNever(state);
  }
}

function getOwnTone(kind: StackPullRequestPipKind): StackLook['tone'] {
  switch (kind) {
    case 'ready':
      return 'success';
    case 'merged':
      return 'done';
    case 'closed':
    case 'broken':
      return 'danger';
    case 'draft':
      return 'muted';
    case 'moving':
    case 'merging':
      return 'warning';
    case 'waiting':
      return 'dim';
    default:
      return assertNever(kind);
  }
}
</script>

<template>
  <ol
    :class="css.stackMergeMembers"
    :aria-label="t(l.listLabel)"
  >
    <template
      v-for="item in drawn"
      :key="item.key"
    >
      <li
        :class="[css.stackMergeMembers_row, item.dimmed && css.stackMergeMembers_row_dimmed]"
        tid="stack-member"
      >
        <component
          :is="item.icon"
          :class="[
            css.stackMergeMembers_icon,
            css[`stackMergeMembers_icon_${item.iconTone}`],
            item.spin && css.stackMergeMembers_icon_spin,
          ]"
          aria-hidden="true"
        />
        <template v-if="item.pullRequest">
          <span :class="css.stackMergeMembers_number">#{{ item.pullRequest.number }}</span>
          <span :class="css.stackMergeMembers_title">{{ item.pullRequest.title }}</span>
        </template>
        <StackTone
          :look="{ icon: item.icon, tone: item.tone }"
          words-only
          :class="[
            css.stackMergeMembers_state,
            item.spin && css.stackMergeMembers_hidden,
            !item.pullRequest && css.stackMergeMembers_state_missing,
          ]"
          >{{ item.text }}</StackTone
        >
        <template v-if="item.going && !item.spin">
          <GitMerge
            :class="css.stackMergeMembers_lands"
            aria-hidden="true"
          />
          <span :class="css.stackMergeMembers_hidden">{{ t(l.lands) }}</span>
        </template>
      </li>
      <li
        v-if="item.lineAfter"
        :class="css.stackMergeMembers_line"
        tid="stack-line"
      >
        <span :class="css.stackMergeMembers_rule" />
        <span :class="css.stackMergeMembers_lineLabel">{{
          line === 'held' ? t(l.canGoUpToHere) : t(l.stopsHere)
        }}</span>
        <Kbd keys="↑" />
        <Kbd keys="↓" />
        <span :class="css.stackMergeMembers_rule" />
      </li>
    </template>
  </ol>
</template>

<style lang="scss" module="css">
.stackMergeMembers {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 6px;
  padding: $spacing-10 14px;
  margin: 0;
  list-style: none;
}

.stackMergeMembers_row {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 20px;
  white-space: nowrap;
}

.stackMergeMembers_icon {
  flex: none;
  width: 13px;
  height: 13px;

  .stackMergeMembers_row_dimmed & {
    opacity: 0.45;
  }
}

.stackMergeMembers_icon_open,
.stackMergeMembers_icon_success {
  color: $color-green;
}

.stackMergeMembers_icon_done {
  color: $color-purple;
}

.stackMergeMembers_icon_closed,
.stackMergeMembers_icon_danger {
  color: $color-red;
}

.stackMergeMembers_icon_warning {
  color: $color-amber;
}

.stackMergeMembers_icon_draft,
.stackMergeMembers_icon_muted,
.stackMergeMembers_icon_dim {
  color: $color-fg-3;
}

.stackMergeMembers_icon_spin {
  animation: stack-merge-members-spin 1s linear infinite;
}

.stackMergeMembers_number {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.stackMergeMembers_title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-sm;
  color: $color-fg-2;

  .stackMergeMembers_row_dimmed & {
    color: $color-fg-dim;
  }
}

.stackMergeMembers_state {
  flex: none;
  font-size: $font-size-xs;
}

.stackMergeMembers_state_missing {
  flex: 1;
}

.stackMergeMembers_lands {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.stackMergeMembers_line {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

.stackMergeMembers_rule {
  flex: 1;
  height: 1px;
  background: $color-accent;
}

.stackMergeMembers_lineLabel {
  flex: none;
  font-size: $font-size-2xs;
  color: $color-accent;
}

.stackMergeMembers_hidden {
  @include visually-hidden;
}

@keyframes stack-merge-members-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
