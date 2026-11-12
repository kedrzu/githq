<!-- The map of a stack beside an opened pull request of it (stacked PRs D9, D25, SP30, SP35–SP36), read from the local copy: its pull requests first to last — merged ones too, none folded — each with its number and title, `K`/`J` right after the titles of the rows those keys open, its state at the far end, this one highlighted; then a line saying what stops the stack — being merged, every one going says so and the line that stacks take longer, none merged until GitHub confirms (SP7). A click on a row opens that pull request in this one's place. In a panel it is the rows alone, each saying its state in words: the stack bar above the content (`StackBar`) names the stack, and the panel shows the map at the top of its content, or dropped over it from the bar (D27). On a page it carries the stack's name and this one's place, the icons carrying each state. No merge here: `⇧M` merges. -->
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
import { Layers, Loader } from 'lucide-vue-next';
import { computed } from 'vue';

import Kbd from '@/components/Kbd.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import DraftDot from '@/lists/DraftDot.vue';
import StackTone from '@/lists/StackTone.vue';
import type { StackLook, StackStateFact } from '@/lists/useStackFacts.js';
import { getHeldReason } from '@/lists/utils/getHeldReason.js';
import { getPullRequestLook } from '@/lists/utils/getPullRequestLook.js';
import { getStackMemberKind } from '@/lists/utils/getStackMemberKind.js';
import { getStackRowText } from '@/lists/utils/getStackRowText.js';
import { getStackStateFact } from '@/lists/utils/getStackStateFact.js';
import { useMergeQueueTexts } from '@/merge/useMergeQueueTexts.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type {
  StackDescription,
  StackHeldState,
  StackPullRequestPip,
  StackState,
} from '@/store/stacks/describeStack.js';
import { getStackMembers } from '@/store/stacks/getStackMembers.js';
import { getStackPlace } from '@/store/stacks/getStackPlace.js';

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
  }>(),
  { neighbours: null },
);

const emit = defineEmits<{
  /** A row picked: its pull request opens in this one's place. */
  open: [id: string];
}>();

/** A pull request of the stack as its row shows it. */
interface StackMapRow extends StackLook {
  readonly pullRequest: PullRequestItem;
  /** Its state in words, in a panel; `null` when its icon says it all. */
  readonly text: string | null;
  readonly current: boolean;
  /** The key that opens it from the opened one. */
  readonly key: 'J' | 'K' | null;
}

const t = useTranslate();
const queueTexts = useMergeQueueTexts();

const members = computed(() => getStackMembers(props.stack.pips));
const rows = computed(() => members.value.map(pip => getRow(pip)));
const place = computed(() =>
  t(l.place, { position: getStackPlace(members.value, props.currentId), size: props.stack.size }),
);
const verdict = computed(() => getVerdict());

function getRow(pip: StackPullRequestPip): StackMapRow {
  const { pullRequest } = pip;
  const { id } = pullRequest;
  const kind = getStackMemberKind(pip);
  return {
    pullRequest,
    ...getPullRequestLook(kind),
    text: props.arrangement === 'panel' ? getStackRowText({ kind, pullRequest, lang: APP_LANGUAGE }) : null,
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

/**
 * What stops the stack merging, or that nothing does — worded as the list's sentence, without the counts it shows;
 * being merged, that it takes a while (SP7): the rows say which are going.
 */
function getVerdict(): StackStateFact {
  if (props.stack.state.kind === 'merging') {
    return { icon: Loader, tone: 'warning', text: t(l.takesLonger) };
  }

  return getStackStateFact({
    state: getStopState(props.stack.state),
    lang: APP_LANGUAGE,
    getHeldText,
    getQueuedText: ({ entry }) => queueTexts.group(entry),
  });
}

/** The map says what stops the stack even where the entry asks for the viewer's review (brief "work through a stack"). */
function getStopState(state: StackState): StackState {
  if (state.kind !== 'reviewRequested') {
    return state;
  }

  const { blocker, openCount, readyCount } = state;
  return blocker ? { kind: 'held', blocker, openCount, readyCount } : { kind: 'ready', openCount };
}

/** "#41 is waiting for review", "#65 stops 4 later from landing". */
function getHeldText({ blocker, openCount, readyCount }: StackHeldState): string {
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
      return later > 0 ? t(l.heldStopsLater, { number, later }) : t(l.heldAlone, { number });
    }
    default:
      return assertNever(reason);
  }
}

function openRow(row: StackMapRow) {
  if (!row.current) {
    emit('open', row.pullRequest.id);
  }
}
</script>

<template>
  <section
    :class="[css.stackMap, css[`stackMap_${arrangement}`]]"
    :aria-label="t(l.label)"
  >
    <!-- D25: in a panel the stack bar above names the stack and shows the places. -->
    <div
      v-if="arrangement !== 'panel'"
      :class="css.stackMap_head"
    >
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
        v-for="row in rows"
        :key="row.pullRequest.id"
      >
        <button
          type="button"
          :class="[css.stackMap_row, row.current && css.stackMap_row_current]"
          :aria-current="row.current ? 'true' : undefined"
          :aria-keyshortcuts="row.key ?? undefined"
          @click="openRow(row)"
        >
          <StackTone
            :look="row"
            :class="css.stackMap_rowIcon"
          />
          <span :class="css.stackMap_number">#{{ row.pullRequest.number }}</span>
          <span :class="css.stackMap_title">{{ row.pullRequest.title }}</span>
          <DraftDot v-if="row.pullRequest.pendingReview" />
          <!-- Right after the title: the states stay aligned at the far end while the keys move (D25). -->
          <Kbd
            v-if="row.key"
            :keys="row.key"
            size="sm"
          />
          <StackTone
            v-if="row.text"
            :look="row"
            words-only
            :class="[css.stackMap_rowText, row.tone === 'muted' && css.stackMap_rowText_muted]"
          >
            {{ row.text }}
          </StackTone>
        </button>
      </li>
    </ol>
    <StackTone
      :look="verdict"
      :class="css.stackMap_verdict"
    >
      {{ verdict.text }}
    </StackTone>
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

// The first block of the panel's content, or dropped over it from the stack bar: the panel draws the edge under it.
.stackMap_panel {
  flex: none;
  padding: $spacing-10 $spacing-16;
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
.stackMap_number {
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

// Its surface inset only above and below: the map's own padding is the row's edge, its text 6px into the surface.
.stackMap_row {
  @include row-surface($color-bg-3);
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 $spacing-6;
  font: inherit;
  color: $color-fg-2;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  --row-surface-inset: #{$spacing-2} 0;
}

.stackMap_row_current {
  @include row-selected;

  color: $color-fg;
  cursor: default;
}

.stackMap_rowIcon {
  flex: none;
  width: 12px;
  height: 12px;
}

// Only as wide as its text: the key follows it, the state keeps the far end.
.stackMap_title {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stackMap_rowText {
  flex: none;
  margin-left: auto;
  font-size: $font-size-xs;
  white-space: nowrap;
}

// A row's "Waiting for review" is quieter than the list's grey for the same tone (SP30, SP31).
.stackMap_rowText.stackMap_rowText_muted {
  color: $color-fg-dim;
}

.stackMap_verdict {
  gap: $spacing-6;
  padding: $spacing-4 $spacing-6 0;
  font-size: $font-size-xs;
}
</style>
