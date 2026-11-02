<!-- The map of a stack beside an opened pull request of it (stacked PRs D9, D17, SP30–SP36), read from the local copy: the stack's name and this one's place ("6 of 10"), its pull requests first to last — merged ones too — each with its number, title and state, this one highlighted and `K`/`J` on the rows those keys open, and a line saying what stops the stack. A click on a row opens that pull request in this one's place. In a panel a long stack shows a window of six lines — one before this one, two after, the rest folded into a line saying what they hold — and each row says its state in words; `folded`, it is one line (SP32): the pips with this one tall, the place, what stops the stack and the neighbours on `K` and `J`, a click unfolds it. In a modal and on a page it is whole, the icons carrying each state (SP33–SP36). No merge here: `⇧M` merges. -->
<script lang="ts">
/** The items `K` and `J` open from the opened one, by id; `null` at either end of the list or outside one. */
export interface StackNeighbours {
  readonly previous: string | null;
  readonly next: string | null;
}
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { ChevronDown, Ellipsis, Layers } from 'lucide-vue-next';
import { computed } from 'vue';

import Kbd from '@/components/Kbd.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import StackPips from '@/lists/StackPips.vue';
import StackTone from '@/lists/StackTone.vue';
import type { StackLook, StackStateFact } from '@/lists/useStackFacts.js';
import { getHeldReason } from '@/lists/utils/getHeldReason.js';
import { getPullRequestLook } from '@/lists/utils/getPullRequestLook.js';
import { getStackStateFact } from '@/lists/utils/getStackStateFact.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type {
  StackDescription,
  StackHeldState,
  StackPip,
  StackPullRequestPip,
  StackPullRequestPipKind,
} from '@/store/stacks/describeStack.js';

import { getStackMapWindow } from './getStackMapWindow.js';
import type { ItemArrangement } from './itemRoutes.js';
import * as l from './StackMap.loc.js';

const props = withDefaults(
  defineProps<{
    stack: StackDescription;
    /** The id of the pull request opened. */
    currentId: string;
    /** What `K` and `J` open: the rows they open carry the key. */
    neighbours?: StackNeighbours | null;
    arrangement: ItemArrangement;
    /** In a panel, once its content scrolls: one line (SP32). */
    folded?: boolean;
  }>(),
  { neighbours: null, folded: false },
);

const emit = defineEmits<{
  /** A row picked: its pull request opens in this one's place. */
  open: [id: string];
  /** The folded line clicked. */
  unfold: [];
}>();

/** A pull request of the stack as its row shows it. */
interface StackMapRow extends StackLook {
  readonly kind: 'row';
  readonly pullRequest: PullRequestItem;
  /** Its state in words, in a panel; `null` when its icon says it all. */
  readonly text: string | null;
  readonly current: boolean;
  /** The key that opens it from the opened one. */
  readonly key: 'J' | 'K' | null;
}

/** The pull requests before or after a panel's window, folded into one line saying what they hold. */
interface StackMapFold {
  readonly kind: 'fold';
  readonly side: 'earlier' | 'later';
  readonly text: string;
  readonly pips: readonly StackPip[];
}

const t = useTranslate();
const unitList = new Intl.ListFormat(APP_LANGUAGE, { type: 'unit', style: 'short' });

const members = computed(() => props.stack.pips.filter((pip): pip is StackPullRequestPip => pip.kind !== 'missing'));
const rows = computed(() => members.value.map(pip => getRow(pip)));
const currentIndex = computed(() =>
  Math.max(
    members.value.findIndex(pip => pip.pullRequest.id === props.currentId),
    0,
  ),
);
const place = computed(() => {
  const position = members.value[currentIndex.value]?.pullRequest.stack?.position ?? currentIndex.value + 1;
  return t(l.place, { position, size: props.stack.size });
});
// D17: a panel's window of at most six lines; a modal and a page show every row.
const lines = computed((): readonly (StackMapFold | StackMapRow)[] => {
  const all = rows.value;
  if (props.arrangement !== 'panel') {
    return all;
  }

  const { start, end } = getStackMapWindow(all.length, currentIndex.value);
  const shown: (StackMapFold | StackMapRow)[] = all.slice(start, end + 1);
  if (start > 0) {
    shown.unshift(getFold('earlier', members.value.slice(0, start)));
  }

  if (end < all.length - 1) {
    shown.push(getFold('later', members.value.slice(end + 1)));
  }

  return shown;
});
const verdict = computed(() => getVerdict(l.heldStopsLater));
// SP32: the folded strip is short of room, so its sentence is too.
const stripVerdict = computed(() => getVerdict(l.heldBlocksLater));
const neighbourNumbers = computed(() => ({
  previous: findMember(props.neighbours?.previous)?.number ?? null,
  next: findMember(props.neighbours?.next)?.number ?? null,
}));

function getRow({ kind, pullRequest }: StackPullRequestPip): StackMapRow {
  const { id } = pullRequest;
  return {
    kind: 'row',
    pullRequest,
    ...getPullRequestLook(kind),
    text: props.arrangement === 'panel' ? getRowText(kind, pullRequest) : null,
    current: id === props.currentId,
    key: getKey(id),
  };
}

function getKey(id: string): 'J' | 'K' | null {
  if (id === props.currentId) {
    return null;
  }

  if (id === props.neighbours?.previous) {
    return 'K';
  }

  return id === props.neighbours?.next ? 'J' : null;
}

/** A row's state in words, from the pull request itself where its pip is pale while the copy is incomplete (D7). */
function getRowText(kind: StackPullRequestPipKind, pr: PullRequestItem): string | null {
  if (pr.merged || pr.state === 'MERGED') {
    return t(l.merged);
  }

  if (pr.state === 'CLOSED') {
    return t(l.closed);
  }

  const standing = getPullRequestStanding(pr);
  switch (kind) {
    case 'draft':
      return t(l.draft);
    case 'ready':
      return t(l.ready);
    case 'broken':
      if (standing.checksFailing) {
        return standing.failingChecks > 0
          ? t(l.checksFailing, { count: standing.failingChecks })
          : t(l.checksFailingUncounted);
      }

      return standing.changesRequested ? t(l.changesRequested) : t(l.conflicts);
    case 'moving':
      // Moving without running checks: the stack needs a rebase (D21).
      return standing.checksRunning ? t(l.checksRunning) : t(l.needsRebaseRow);
    case 'waiting':
      return standing.waitingForReview ? t(l.waitingForReview) : t(l.cannotMergeYet);
    case 'merged':
    case 'closed':
      return null;
    default:
      return assertNever(kind);
  }
}

/** "4 earlier · 2 landed, 2 ready" (SP31): how many, then those landed, ready, failing, drafts and closed. */
function getFold(side: StackMapFold['side'], folded: readonly StackPullRequestPip[]): StackMapFold {
  const counts = new Map<StackPullRequestPipKind, number>();
  for (const pip of folded) {
    counts.set(pip.kind, (counts.get(pip.kind) ?? 0) + 1);
  }

  const summaries = [
    ['merged', l.foldLanded],
    ['ready', l.foldReady],
    ['broken', l.foldFailing],
    ['draft', l.foldDrafts],
    ['closed', l.foldClosed],
  ] as const;
  const parts: string[] = [];
  for (const [kind, text] of summaries) {
    const held = counts.get(kind) ?? 0;
    if (held > 0) {
      parts.push(t(text, { count: held }));
    }
  }

  const fold = t(side === 'earlier' ? l.earlier : l.later, { count: folded.length });
  return {
    kind: 'fold',
    side,
    text: parts.length > 0 ? t(l.foldWithSummary, { fold, summary: unitList.format(parts) }) : fold,
    pips: folded,
  };
}

/** What stops the stack merging, or that nothing does — worded as the list's sentence, without the counts it shows. */
function getVerdict(stopsLater: typeof l.heldStopsLater): StackStateFact {
  return getStackStateFact({ state: props.stack.state, t, getHeldText: state => getHeldText(state, stopsLater) });
}

/** "#41 is waiting for review", "#65 stops 4 later from landing" — or, in the strip, "#65 blocks 4 later". */
function getHeldText({ blocker, openCount, readyCount }: StackHeldState, stopsLater: typeof l.heldStopsLater): string {
  const { number } = blocker;
  const reason = getHeldReason(blocker);
  switch (reason) {
    case 'draft':
      return t(l.heldByDraft, { number });
    case 'checks':
      return t(l.heldByChecks, { number });
    case 'review':
      return t(l.heldByReview, { number });
    case 'other': {
      const later = openCount - readyCount - 1;
      return later > 0 ? t(stopsLater, { number, later }) : t(l.heldAlone, { number });
    }
    default:
      return assertNever(reason);
  }
}

function findMember(id: string | null | undefined): PullRequestItem | undefined {
  return id == null ? undefined : members.value.find(pip => pip.pullRequest.id === id)?.pullRequest;
}

function openRow(row: StackMapRow) {
  if (!row.current) {
    emit('open', row.pullRequest.id);
  }
}
</script>

<template>
  <section
    :class="[css.stackMap, css[`stackMap_${arrangement}`], folded && css.stackMap_folded]"
    :aria-label="t(l.label)"
  >
    <button
      v-if="folded"
      type="button"
      :class="css.stackMap_strip"
      @click="emit('unfold')"
    >
      <span :class="css.stackMap_hidden">{{ t(l.unfold) }}</span>
      <Layers
        :class="css.stackMap_icon"
        aria-hidden="true"
      />
      <StackPips
        :pips="stack.pips"
        :current="currentId"
      />
      <span :class="css.stackMap_place">{{ place }}</span>
      <StackTone
        :look="stripVerdict"
        :class="css.stackMap_stripVerdict"
      >
        {{ stripVerdict.text }}
      </StackTone>
      <span :class="css.stackMap_neighbours">
        <span v-if="neighbourNumbers.previous !== null">#{{ neighbourNumbers.previous }}</span>
        <Kbd
          v-if="neighbourNumbers.previous !== null"
          keys="K"
          size="sm"
        />
        <Kbd
          v-if="neighbourNumbers.next !== null"
          keys="J"
          size="sm"
        />
        <span v-if="neighbourNumbers.next !== null">#{{ neighbourNumbers.next }}</span>
      </span>
      <ChevronDown
        :class="css.stackMap_chevron"
        aria-hidden="true"
      />
    </button>
    <template v-else>
      <div :class="css.stackMap_head">
        <Layers
          :class="css.stackMap_icon"
          aria-hidden="true"
        />
        <span :class="css.stackMap_name">{{ stack.name.title }}</span>
        <span :class="css.stackMap_place">{{ place }}</span>
      </div>
      <ol
        :class="css.stackMap_rows"
        :aria-label="t(l.pullRequests)"
      >
        <li
          v-for="line in lines"
          :key="line.kind === 'row' ? line.pullRequest.id : line.side"
        >
          <div
            v-if="line.kind === 'fold'"
            :class="css.stackMap_fold"
          >
            <Ellipsis
              :class="css.stackMap_rowIcon"
              aria-hidden="true"
            />
            <span :class="css.stackMap_foldText">{{ line.text }}</span>
            <StackPips :pips="line.pips" />
          </div>
          <button
            v-else
            type="button"
            :class="[css.stackMap_row, line.current && css.stackMap_row_current]"
            :aria-current="line.current ? 'true' : undefined"
            :aria-keyshortcuts="line.key ?? undefined"
            @click="openRow(line)"
          >
            <StackTone
              :look="line"
              :class="css.stackMap_rowIcon"
            />
            <span :class="css.stackMap_number">#{{ line.pullRequest.number }}</span>
            <span :class="css.stackMap_title">{{ line.pullRequest.title }}</span>
            <StackTone
              v-if="line.text"
              :look="line"
              words-only
              :class="[css.stackMap_rowText, line.tone === 'muted' && css.stackMap_rowText_muted]"
            >
              {{ line.text }}
            </StackTone>
            <Kbd
              v-if="line.key"
              :keys="line.key"
              size="sm"
            />
          </button>
        </li>
      </ol>
      <StackTone
        :look="verdict"
        :class="css.stackMap_verdict"
      >
        {{ verdict.text }}
      </StackTone>
    </template>
  </section>
</template>

<style lang="scss" module="css">
.stackMap {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
  font-size: $font-size-sm;
}

// Pinned above the panel's content, which scrolls under it.
.stackMap_panel {
  flex: none;
  padding: $spacing-10 $spacing-16;
  border-bottom: 1px solid $color-border;
}

.stackMap_folded {
  padding: 0;
}

// At the top of the side column, apart from the reviews under it.
.stackMap_modal {
  padding-bottom: $spacing-16;
  border-bottom: 1px solid $color-border;
}

// A column of its own on the left, as tall as the page: the stack's contents.
.stackMap_page {
  flex: none;
  width: 300px;
  height: 100%;
  padding: 28px $spacing-16;
  overflow-y: auto;
  border-right: 1px solid $color-border;
}

.stackMap_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  padding: 0 $spacing-6;
  line-height: 22px;
}

.stackMap_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-2;
}

.stackMap_name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stackMap_place,
.stackMap_number,
.stackMap_neighbours {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.stackMap_rows {
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  list-style: none;
}

.stackMap_row,
.stackMap_fold {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 23px;
  padding: 0 $spacing-6;
}

.stackMap_row {
  font: inherit;
  color: $color-fg-2;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-sm;

  @include focus-ring;

  &:hover {
    background: $color-bg-3;
  }
}

.stackMap_row_current,
.stackMap_row_current:hover {
  color: $color-fg;
  cursor: default;
  background: $color-sel;
  box-shadow: inset 2px 0 0 $color-accent;
}

.stackMap_rowIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

.stackMap_title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stackMap_rowText {
  flex: none;
  font-size: $font-size-xs;
  white-space: nowrap;
}

// A row's "Waiting for review" is quieter than the list's grey for the same tone (SP30, SP31).
.stackMap_rowText.stackMap_rowText_muted {
  color: $color-fg-dim;
}

.stackMap_fold {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.stackMap_foldText {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stackMap_verdict {
  gap: $spacing-6;
  padding: $spacing-4 $spacing-6 0;
  font-size: $font-size-xs;
}

.stackMap_strip {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 $spacing-16;
  font: inherit;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;

  @include focus-ring;

  &:hover {
    background: $color-bg-3;
  }
}

.stackMap_stripVerdict {
  gap: $spacing-6;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.stackMap_neighbours {
  display: inline-flex;
  gap: $spacing-4;
  align-items: center;
  margin-left: auto;
}

.stackMap_hidden {
  @include visually-hidden;
}

.stackMap_chevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: $color-fg-3;
}
</style>
