<!-- A repository's Commits section (git-client D9, D18, CH3): its commit graph, in any repository the user can see, tracked or not (D11). Opening it opens the graph in `CommitGraphStore` — the kept copy at once, then GitHub asked in the background — and only the rows near the viewport are drawn, so thousands of commits scroll as fast as a hundred. The rows on screen ask for their pull request and CI state; coming within a screen of the last loaded row reads the next page, "Loading older commits…" under the rows meanwhile (CH35), and the first commit of the repository ends the graph with "The beginning of its history" (CH36). An empty repository says so (CH38); a first open with nothing kept yet is a quiet line until the first rows arrive. `J`/`K` or ↓/↑ move a cursor row, kept in view, which starts on the newest commit (CH23); a click moves it there. Commits arriving above its row, moved or not, leave that row where it was on screen (D19), a scroll up away; when its commit is gone it stays at the same height. The graph takes the width of its lanes up to a tenth of the pane; the lanes past that are folded onto the last (D17). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { Flag, GitCommitHorizontal, LoaderCircle } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { useCommands } from '@/commands/useCommands.js';
import EmptyState from '@/components/EmptyState.vue';
import { useNow } from '@/services/useNow.js';
import { isScreenKey } from '@/utils/isScreenKey.js';

import { COMMIT_GRAPH_LANE_WIDTH, COMMIT_GRAPH_PADDING } from './CommitGraphCell.vue';
import { CommitGraphStore } from './CommitGraphStore.js';
import * as l from './CommitGraphView.loc.js';
import CommitRow, { COMMIT_ROW_HEIGHT } from './CommitRow.vue';
import type { CommitRowRef } from './CommitRow.vue';
import type { KeptCommit } from './CommitTypes.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
}>();

/** How many rows are drawn above and below the viewport, so a quick scroll shows no gap. */
const OVERSCAN = 8;
/** The share of the pane the graph takes at most (D17's default). */
const GRAPH_SHARE = 0.1;
/** The fewest lanes the graph shows when it needs more, however narrow the pane. */
const MIN_LANES = 2;
/** How often the ages move on. */
const AGE_TICK_MS = 30_000;

const store = useService(CommitGraphStore);
const accounts = useService(AccountSession);
const t = useTranslate();
const now = useNow(AGE_TICK_MS);

const scroller = useTemplateRef<HTMLElement>('scroller');
const scrollTop = ref(0);
const viewportHeight = ref(0);
const paneWidth = ref(0);
/** The commit under the cursor; the newest when the first rows arrive. */
const cursorOid = ref<string | null>(null);

const graph = computed(() => store.get(props.nameWithOwner));
const commits = computed((): readonly KeptCommit[] => graph.value?.commits ?? []);
const count = computed(() => commits.value.length);
/** What the section shows: the graph, or before it, a quiet line, the empty repository, or why nothing arrives. */
const shown = computed(() => {
  const current = graph.value;
  if (current && current.commits.length > 0) {
    return 'graph';
  }

  const freshness = store.getFreshness(props.nameWithOwner);
  if (freshness.kind === 'stale' || freshness.kind === 'paused') {
    return 'unavailable';
  }

  return current?.refs && !current.joining ? 'empty' : 'loading';
});
const lanes = computed(() => {
  const needed = Math.max(1, graph.value?.layout.maxWidth ?? 1);
  const fitting = Math.floor((paneWidth.value * GRAPH_SHARE - COMMIT_GRAPH_PADDING * 2) / COMMIT_GRAPH_LANE_WIDTH);
  return Math.min(needed, Math.max(MIN_LANES, fitting));
});
const screenRows = computed(() => Math.ceil(viewportHeight.value / COMMIT_ROW_HEIGHT));
const firstOnScreen = computed(() => Math.min(count.value, Math.floor(scrollTop.value / COMMIT_ROW_HEIGHT)));
const endOnScreen = computed(() => Math.min(count.value, firstOnScreen.value + screenRows.value + 1));
/** The rows drawn: those on screen and a few around them. */
const drawn = computed(() => {
  const layoutRows = graph.value?.layout.rows ?? [];
  const start = Math.max(0, firstOnScreen.value - OVERSCAN);
  const end = Math.min(count.value, endOnScreen.value + OVERSCAN);
  const rows = [];
  for (let index = start; index < end; index++) {
    const commit = commits.value[index];
    const graphRow = layoutRows[index];
    if (commit && graphRow) {
      rows.push({ index, commit, graphRow });
    }
  }

  return rows;
});
/** The commits on screen: they ask for their pull request and CI state. */
const onScreenOids = computed(() =>
  commits.value.slice(firstOnScreen.value, endOnScreen.value).map(commit => commit.oid),
);
/** The branches and tags pointing at each commit: the default branch first, then branches, then tags. */
const refsByOid = computed(() => {
  const byOid = new Map<string, CommitRowRef[]>();
  const refs = graph.value?.refs;
  if (!refs) {
    return byOid;
  }

  const all: (CommitRowRef & { readonly oid: string })[] = [
    ...refs.branches
      .filter(branch => branch.name === refs.defaultBranch)
      .map(branch => ({ oid: branch.oid, name: branch.name, kind: 'default' as const })),
    ...refs.branches
      .filter(branch => branch.name !== refs.defaultBranch)
      .map(branch => ({ oid: branch.oid, name: branch.name, kind: 'branch' as const })),
    ...refs.tags.map(tag => ({ oid: tag.oid, name: tag.name, kind: 'tag' as const })),
  ];
  for (const { oid, name, kind } of all) {
    const known = byOid.get(oid);
    if (known) {
      known.push({ name, kind });
    } else {
      byOid.set(oid, [{ name, kind }]);
    }
  }

  return byOid;
});

// The graph is asked of GitHub only through the store, which answers from its kept copy first. Another account signed
// in has emptied the store: the graph is opened again for them.
watch(
  [() => props.nameWithOwner, () => accounts.current],
  ([nameWithOwner]) => {
    void store.open(nameWithOwner);
  },
  { immediate: true },
);

watch(
  () => onScreenOids.value.join(' '),
  () => {
    if (onScreenOids.value.length > 0) {
      store.ensureStates(props.nameWithOwner, onScreenOids.value);
    }
  },
  { immediate: true },
);

watch([endOnScreen, count, () => graph.value?.endReached], () => void loadNearEnd());

// The cursor starts on the newest commit and stays there until the user moves it (CH23); once moved, when commits
// arrive above its row, the row keeps its place on screen (D19); when its commit is gone (a branch force-pushed), it
// stays at the same height.
watch(
  commits,
  (next, previous) => {
    const oid = cursorOid.value;
    if (oid === null) {
      cursorOid.value = next[0]?.oid ?? null;
      return;
    }

    const after = next.findIndex(commit => commit.oid === oid);
    const before = previous ? previous.findIndex(commit => commit.oid === oid) : -1;
    if (after === -1) {
      cursorOid.value = next[Math.min(Math.max(before, 0), next.length - 1)]?.oid ?? null;
      return;
    }

    const element = scroller.value;
    if (element && before !== -1 && after !== before) {
      element.scrollTop += (after - before) * COMMIT_ROW_HEIGHT;
      scrollTop.value = element.scrollTop;
    }
  },
  { immediate: true, flush: 'post' },
);

useCommands(() => [
  { id: 'commits.next', title: t(l.next), section: 'view', key: 'J', otherKeys: ['ArrowDown'], menu: false },
  { id: 'commits.previous', title: t(l.previous), section: 'view', key: 'K', otherKeys: ['ArrowUp'], menu: false },
]);

onWindowEvent('keydown', event => {
  if (!isScreenKey(event) || event.shiftKey) {
    return;
  }

  switch (event.key) {
    case 'j':
    case 'ArrowDown':
      event.preventDefault();
      step(1);
      return;
    case 'k':
    case 'ArrowUp':
      event.preventDefault();
      step(-1);
  }
});

let observer: ResizeObserver | undefined;

onMounted(() => {
  const element = scroller.value;
  if (!element) {
    return;
  }

  measure(element);
  observer = new ResizeObserver(() => measure(element));
  observer.observe(element);
});

onBeforeUnmount(() => observer?.disconnect());

/**
 * Within a screen of the last loaded row, the next page — and the one after it while a page leaves the end that near,
 * for a short one changes nothing the watch above follows once it is done. Not again on its own when one fails or
 * brings nothing: the next scroll asks.
 */
async function loadNearEnd() {
  const current = graph.value;
  if (
    !current?.refs ||
    current.endReached ||
    current.loadingMore ||
    count.value === 0 ||
    endOnScreen.value + screenRows.value < count.value
  ) {
    return;
  }

  const before = count.value;
  await store.loadMore(props.nameWithOwner);
  if (count.value > before) {
    void loadNearEnd();
  }
}

function measure(element: HTMLElement) {
  viewportHeight.value = element.clientHeight;
  paneWidth.value = element.clientWidth;
  scrollTop.value = element.scrollTop;
}

function onScroll() {
  scrollTop.value = scroller.value?.scrollTop ?? 0;
}

function moveCursor(oid: string | null) {
  cursorOid.value = oid;
}

/** Moves the cursor `by` rows, keeping its row in view. */
function step(by: number) {
  if (count.value === 0) {
    return;
  }

  const index = commits.value.findIndex(commit => commit.oid === cursorOid.value);
  const next = Math.min(count.value - 1, Math.max(0, index + by));
  moveCursor(commits.value[next]?.oid ?? null);
  reveal(next);
}

function reveal(index: number) {
  const element = scroller.value;
  if (!element) {
    return;
  }

  const top = index * COMMIT_ROW_HEIGHT;
  if (top < element.scrollTop) {
    element.scrollTop = top;
  } else if (top + COMMIT_ROW_HEIGHT > element.scrollTop + element.clientHeight) {
    element.scrollTop = top + COMMIT_ROW_HEIGHT - element.clientHeight;
  }

  scrollTop.value = element.scrollTop;
}
</script>

<template>
  <div
    ref="scroller"
    :class="css.commitGraphView"
    tabindex="0"
    :aria-label="t(l.commitsOf, { name: nameWithOwner })"
    role="region"
    @scroll.passive="onScroll"
  >
    <p
      v-if="shown === 'loading'"
      :class="css.commitGraphView_note"
    >
      <LoaderCircle
        :class="css.commitGraphView_noteIcon"
        aria-hidden="true"
      />
      {{ t(l.loading) }}
    </p>
    <p
      v-else-if="shown === 'unavailable'"
      :class="css.commitGraphView_note"
    >
      {{ t(l.unavailable) }}
    </p>
    <EmptyState
      v-else-if="shown === 'empty'"
      :icon="GitCommitHorizontal"
      :title="t(l.emptyTitle)"
      :detail="t(l.emptyDetail, { name: nameWithOwner })"
    />
    <template v-else>
      <ul
        :class="css.commitGraphView_rows"
        :style="{ height: `${count * COMMIT_ROW_HEIGHT}px` }"
      >
        <li
          v-for="row in drawn"
          :key="row.commit.oid"
          :class="[
            css.commitGraphView_row,
            row.index % 2 === 1 && css.commitGraphView_row_odd,
            row.commit.oid === cursorOid && css.commitGraphView_row_cursor,
          ]"
          :style="{ top: `${row.index * COMMIT_ROW_HEIGHT}px`, height: `${COMMIT_ROW_HEIGHT}px` }"
          :aria-current="row.commit.oid === cursorOid ? 'true' : undefined"
          :aria-posinset="row.index + 1"
          :aria-setsize="graph?.endReached ? count : -1"
          @click="moveCursor(row.commit.oid)"
        >
          <CommitRow
            :commit="row.commit"
            :graph-row="row.graphRow"
            :lanes="lanes"
            :refs="refsByOid.get(row.commit.oid) ?? []"
            :state="store.getState(nameWithOwner, row.commit.oid)"
            :now="now"
          />
        </li>
      </ul>
      <p
        v-if="graph?.loadingMore"
        :class="css.commitGraphView_note"
      >
        <LoaderCircle
          :class="css.commitGraphView_noteIcon"
          aria-hidden="true"
        />
        {{ t(l.loadingMore) }}
      </p>
      <p
        v-else-if="graph?.endReached"
        :class="css.commitGraphView_note"
      >
        <Flag
          :class="css.commitGraphView_noteIcon"
          aria-hidden="true"
        />
        {{ t(l.beginning, { name: nameWithOwner }) }}
      </p>
    </template>
  </div>
</template>

<style lang="scss" module="css">
.commitGraphView {
  @include focus-ring;

  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.commitGraphView_rows {
  position: relative;
  flex: none;
  padding: 0;
  margin: 0;
  list-style: none;
}

.commitGraphView_row {
  position: absolute;
  right: 0;
  left: 0;
  cursor: default;

  &:hover {
    background: $color-bg-2;
  }
}

// D18.
.commitGraphView_row_odd {
  background: $color-row-stripe;
}

// As a list's selected row.
.commitGraphView_row_cursor,
.commitGraphView_row_cursor:hover {
  background: $color-sel;
  box-shadow: inset 2px 0 0 $color-accent;
}

.commitGraphView_note {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-12 $spacing-20;
  font-size: $font-size-sm;
  color: $color-fg-dim;
  border-top: 1px solid $color-border;
}

.commitGraphView_noteIcon {
  flex: none;
  width: 13px;
  height: 13px;
}
</style>
