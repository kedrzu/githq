<!-- A repository's Commits section (git-client D9, D18, CH3): its commit graph, in any repository the user can see, tracked or not (D11). Opening it opens the graph in `CommitGraphStore` — the kept copy at once, then GitHub asked in the background — and only the rows near the viewport are drawn, so thousands of commits scroll as fast as a hundred. The rows on screen ask for their pull request and CI state; coming within a screen of the last loaded row reads the next page, "Loading older commits…" under the rows meanwhile (CH35), and the first commit of the repository ends the graph with "The beginning of its history" (CH36); offline, what is kept stays and the last row says older commits wait (CH40). An empty repository says so (CH38); a first open with nothing kept yet is a quiet line until the first rows arrive. `J`/`K` or ↓/↑ move a cursor row, kept in view, which starts on the newest commit (CH23); a click moves it there. Commits arriving above its row, moved or not, leave that row where it was on screen (D19), a scroll up away; when its commit is gone it moves to its nearest neighbour, like every list, at the same height. A divider sets the graph's share of the pane, a tenth by default and kept on this device: dragged, or by a lane with ←/→, from two lanes to every lane; a double-click or `Enter` resets it, and the lanes that don't fit fold onto the last (D17). Beside the graph, the branches and tags (`CommitRefList`, D15), folding away below about 1,200 px of window; `B` or the header's tool (`openRefList`) puts the cursor in their filter, over the graph when folded. Choosing one with its commit loaded scrolls the graph to it, a third of the way down, with the cursor on it (D12); with its commit not loaded the graph stays and that commit's details open (CH16); either way the keys are back on the graph and the list's filter cleared. `Enter` opens the cursor's commit's details in the list's place, over the graph where the list is folded (`CommitDetails`, D16), held here and in no address: `J`/`K` and a click go on moving the cursor and they follow, `P` and `Shift+P` go to a parent — selected in the graph when it is a row, opened beside it when not — `Shift+Enter` opens the pull request as any item opens, in their place until it closes, `O` opens GitHub, and `Esc` closes them, focus on the graph and the list back as new. The list isn't mounted meanwhile. A commit gone from the graph (a branch force-pushed) stays open, saying so, until the keys move on (CH41); while the details show a commit that isn't the cursor's (CH16, CH41) no row is drawn as the cursor, which `J`/`K` still move from. While an item is opened over the section the keys are the item's. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { onWindowResize } from '@nzyme/vue-utils/onWindowResize.js';
import { CloudOff, Flag, GitCommitHorizontal, LoaderCircle, MoveHorizontal } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import { useCommands } from '@/commands/useCommands.js';
import EmptyState from '@/components/EmptyState.vue';
import { getOpenedItemRoute, parseItemUrl } from '@/item/itemRoutes.js';
import { useOpenItemReference } from '@/item/useOpenItemReference.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { useNow } from '@/services/useNow.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenCovered } from '@/utils/isScreenCovered.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';
import { isScreenKey } from '@/utils/isScreenKey.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import CommitDetails, { COMMIT_DETAILS_KEYS } from './CommitDetails.vue';
import { CommitGraphStore } from './CommitGraphStore.js';
import * as l from './CommitGraphView.loc.js';
import CommitRefList from './CommitRefList.vue';
import CommitRow, { COMMIT_ROW_HEIGHT } from './CommitRow.vue';
import type { CommitRowRef } from './CommitRow.vue';
import type { CommitParent, CommitRef, KeptCommit } from './CommitTypes.js';
import { COMMIT_GRAPH_DEFAULT_SHARE, fitCommitGraph, getCommitGraphWidth, getMinLanes } from './fitCommitGraph.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
}>();

/** The commit whose details are open. */
interface OpenedCommit extends CommitParent {
  /** The ref it was opened from, its commit not loaded (D12). */
  readonly chosenRef: CommitRef | null;
}

/** How many rows are drawn above and below the viewport, so a quick scroll shows no gap. */
const OVERSCAN = 8;
/** The name the graph's share of the pane is kept under. */
const GRAPH_PANEL = 'commitGraph';
/** How often the ages move on. */
const AGE_TICK_MS = 30_000;
/** The window's width below which the list of branches and tags folds away (D15). */
const REF_LIST_MIN_WINDOW_WIDTH = 1200;
/** How long the details rest on a commit they moved to before it is read: holding `J` reads only where it stops. */
const DETAIL_PAUSE_MS = 150;

const store = useService(CommitGraphStore);
const accounts = useService(AccountSession);
const browser = useService(Browser);
const clock = useService(Clock);
const route = useRoute();
const openItemReference = useOpenItemReference();
const t = useTranslate();
const now = useNow(AGE_TICK_MS);
const keptShare = useService(LocalPreferences).getPanelShare(GRAPH_PANEL);

const scroller = useTemplateRef<HTMLElement>('scroller');
const refList = useTemplateRef<InstanceType<typeof CommitRefList>>('refList');
const scrollTop = ref(0);
const viewportHeight = ref(0);
const paneWidth = ref(0);
/** The share while the divider is dragged; kept when it is let go. */
const draggedShare = ref<number | null>(null);
/** The arrow keys changed the width and the divider still has focus: its label stays up as while dragging. */
const resizedByKey = ref(false);
const windowWidth = ref(window.innerWidth);
/** Folded away, the list is opened over the graph by `B` or the header's tool. */
const refListOpened = ref(false);
/** Back from the list by a key: the cursor row shows where the keys go, and a ring around the pane would only add noise. */
const focusReturned = ref(false);
/** The commit whose details are open, shown unless an item is opened over them. */
const opened = shallowRef<OpenedCommit | null>(null);

const graph = computed(() => store.get(props.nameWithOwner));
const refs = computed(() => graph.value?.refs ?? null);
const refListFolded = computed(() => windowWidth.value < REF_LIST_MIN_WINDOW_WIDTH);
const commits = computed((): readonly KeptCommit[] => graph.value?.commits ?? []);
const offline = computed(() => {
  const freshness = store.getFreshness(props.nameWithOwner);
  return freshness.kind === 'stale' && freshness.reason === 'offline';
});
const hasRefs = computed(() => (refs.value?.branches.length ?? 0) + (refs.value?.tags.length ?? 0) > 0);
const count = computed(() => commits.value.length);
/** An item is opened over the section (D16, CH29): the keys are its own, and it shows in the details' place. */
const itemOpened = computed(() => getOpenedItemRoute(route) !== null);
const openedUrl = computed(() =>
  opened.value ? `https://github.com/${props.nameWithOwner}/commit/${opened.value.oid}` : '',
);
/** The commit under the cursor: not `selectFirst`, which would follow the newest row and break D19. */
const cursor = useRowSelection({
  rows: commits,
  getKey: commit => commit.oid,
  reveal: oid => reveal(commits.value.findIndex(commit => commit.oid === oid)),
  open: commit => showDetails(commit),
  enabled: () => !itemOpened.value,
});
/** The cursor is drawn on its row, unless the details show a commit it isn't on (CH16, CH41). */
const cursorDrawn = computed(() => !opened.value || opened.value.oid === cursor.selectedKey);
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
const totalLanes = computed(() => Math.max(1, graph.value?.layout.maxWidth ?? 1));
const fit = computed(() =>
  fitCommitGraph({
    share: draggedShare.value ?? keptShare.value ?? COMMIT_GRAPH_DEFAULT_SHARE,
    paneWidth: paneWidth.value,
    totalLanes: totalLanes.value,
  }),
);
const lanesFitLabel = computed(() => t(l.lanesFit, { fit: fit.value.lanes, total: totalLanes.value }));
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
const onScreen = computed(() => commits.value.slice(firstOnScreen.value, endOnScreen.value));
/** The branches and tags pointing at each commit: the default branch first, then branches, then tags. */
const refsByOid = computed(() => {
  const byOid = new Map<string, CommitRowRef[]>();
  const known = refs.value;
  if (!known) {
    return byOid;
  }

  const all: (CommitRowRef & { readonly oid: string })[] = [
    ...known.branches
      .filter(branch => branch.name === known.defaultBranch)
      .map(branch => ({ oid: branch.oid, name: branch.name, kind: 'default' as const })),
    ...known.branches
      .filter(branch => branch.name !== known.defaultBranch)
      .map(branch => ({ oid: branch.oid, name: branch.name, kind: 'branch' as const })),
    ...known.tags.map(tag => ({ oid: tag.oid, name: tag.name, kind: 'tag' as const })),
  ];
  for (const { oid, name, kind } of all) {
    const atCommit = byOid.get(oid);
    if (atCommit) {
      atCommit.push({ name, kind });
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
    opened.value = null;
    void store.open(nameWithOwner);
  },
  { immediate: true },
);

watch(
  () => onScreen.value.map(commit => commit.oid).join(' '),
  () => {
    if (onScreen.value.length > 0) {
      store.ensureStates(props.nameWithOwner, onScreen.value);
    }
  },
  { immediate: true },
);

watch([endOnScreen, count, () => graph.value?.endReached, offline], () => void loadNearEnd());

watch(refListFolded, () => {
  refListOpened.value = false;
});

// The cursor starts on the newest commit (CH23). When commits arrive above its row, moved or not, the row keeps its
// place on screen (D19). When its commit is gone (a branch force-pushed), `useRowSelection` has already moved it to a
// neighbour, which takes the gone commit's height: hence the keys before and after, not just the one now.
watch(
  [commits, () => cursor.selectedKey],
  ([next, oid], [previous, previousOid]) => {
    if (next === previous) {
      return;
    }

    if (oid === null) {
      const newest = next[0];
      if (newest) {
        cursor.select(newest.oid);
      }

      return;
    }

    const after = next.findIndex(commit => commit.oid === oid);
    const before = previous ? previous.findIndex(commit => commit.oid === previousOid) : -1;
    const element = scroller.value;
    if (element && before !== -1 && after !== -1 && after !== before) {
      element.scrollTop += (after - before) * COMMIT_ROW_HEIGHT;
      scrollTop.value = element.scrollTop;
    }
  },
  { immediate: true, flush: 'post' },
);

// The details follow the cursor when the user moves it. A row gone moves it too, and that the details don't follow: the
// commit they show may be the one gone (CH41).
watch(
  () => cursor.selectedKey,
  (oid, previous) => {
    if (!opened.value || oid === opened.value.oid || !commits.value.some(commit => commit.oid === previous)) {
      return;
    }

    const commit = commits.value.find(candidate => candidate.oid === oid);
    if (commit) {
      showDetails(commit);
    }
  },
);

// What the panel shows is read once it rests on a commit. A panel that had no commit has nothing to rest from: it reads
// at once.
watch(
  () => opened.value?.oid,
  (_oid, previous, onCleanup) => {
    const commit = opened.value;
    if (!commit) {
      return;
    }

    if (previous === undefined) {
      readOpened(commit);
    } else {
      onCleanup(clock.schedule(() => readOpened(commit), DETAIL_PAUSE_MS));
    }
  },
);

useCommands(() => [
  { id: 'commits.next', title: t(l.next), section: 'view', key: 'J', otherKeys: ['ArrowDown'], menu: false },
  { id: 'commits.previous', title: t(l.previous), section: 'view', key: 'K', otherKeys: ['ArrowUp'], menu: false },
  { id: 'commits.refList', title: t(l.findRef), section: 'view', key: 'B', menu: false },
  { id: 'commits.details', title: t(l.openDetails), section: 'view', key: 'Enter', menu: false },
  {
    id: 'commits.firstParent',
    title: t(l.firstParent),
    section: 'view',
    key: COMMIT_DETAILS_KEYS.firstParent,
    menu: false,
    when: detailsHaveKeys,
    run: () => goToParent(0),
  },
  {
    id: 'commits.secondParent',
    title: t(l.secondParent),
    section: 'view',
    key: COMMIT_DETAILS_KEYS.secondParent,
    menu: false,
    when: detailsHaveKeys,
    run: () => goToParent(1),
  },
  {
    id: 'commits.pullRequest',
    title: t(l.openPullRequest),
    section: 'view',
    key: COMMIT_DETAILS_KEYS.pullRequest,
    menu: false,
    when: detailsHaveKeys,
    run: openPullRequest,
  },
  {
    id: 'commits.openOnGitHub',
    title: t(l.openOnGitHub),
    section: 'view',
    key: COMMIT_DETAILS_KEYS.openOnGitHub,
    menu: false,
    when: detailsHaveKeys,
    run: () => browser.openInNewTab(openedUrl.value),
  },
  {
    id: 'commits.closeDetails',
    title: t(l.closeDetails),
    section: 'view',
    key: 'Escape',
    menu: false,
    when: () => opened.value !== null,
  },
]);

onWindowResize(() => {
  windowWidth.value = window.innerWidth;
});

onWindowEvent('keydown', event => {
  // An item opened over the section has the keys, Esc first of all.
  if (!isScreenKey(event) || itemOpened.value) {
    return;
  }

  if (event.key === 'Escape') {
    if (isLayerOpen()) {
      return;
    }

    if (opened.value) {
      event.preventDefault();
      closeDetails();
    } else if (refListOpened.value) {
      event.preventDefault();
      refList.value?.leave();
    }

    return;
  }

  if (matchesCommandKey(event, 'B')) {
    event.preventDefault();
    void openRefList();
  }
});

let observer: ResizeObserver | undefined;
let dragStart: { x: number; width: number } | null = null;

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

defineExpose({
  /** Puts the cursor in the filter of the list of branches and tags, opening the list first when it is folded away. */
  openRefList,
});

/**
 * Within a screen of the last loaded row, the next page — and the one after it while a page leaves the end that near,
 * for a short one changes nothing the watch above follows once it is done. Not again on its own when one fails or
 * brings nothing: the next scroll asks, or the connection coming back; offline there is nothing to ask.
 */
async function loadNearEnd() {
  const current = graph.value;
  if (
    !current?.refs ||
    current.endReached ||
    current.loadingMore ||
    offline.value ||
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

async function openRefList() {
  // No refs yet, or none at all: there is no list to open.
  if (!hasRefs.value) {
    return;
  }

  opened.value = null;
  refListOpened.value = refListFolded.value;
  await nextTick();
  refList.value?.focusFilter();
}

/**
 * D12: to the commit, when it is loaded — its row a third of the way down the pane, drawn once scrolled to — whose next
 * `Enter` is on it (CH26). Otherwise the graph stays where it is and the commit's details open in the list's place (CH16).
 * Either way back to the graph, the list's filter cleared.
 */
function onRefChosen(chosen: CommitRef) {
  const index = commits.value.findIndex(commit => commit.oid === chosen.oid);
  if (index === -1) {
    showDetails({ oid: chosen.oid, id: chosen.commitId }, chosen);
  } else {
    cursor.select(chosen.oid);
    const element = scroller.value;
    if (element) {
      element.scrollTop = index * COMMIT_ROW_HEIGHT - Math.round(element.clientHeight / 3);
      scrollTop.value = element.scrollTop;
    }
  }

  refList.value?.leave();
}

function leaveFoldedRefList() {
  if (refListOpened.value) {
    refList.value?.leave();
  }
}

/** Back to the graph, its cursor and scroll as they were. */
function onRefListLeft() {
  refListOpened.value = false;
  returnToGraph();
}

function returnToGraph() {
  focusReturned.value = true;
  scroller.value?.focus({ preventScroll: true });
}

/** The list folded away stays so when they close: it isn't mounted under them, and `Esc` lands on the graph. */
function showDetails({ oid, id }: CommitParent, chosenRef: CommitRef | null = null) {
  opened.value = { oid, id, chosenRef };
  refListOpened.value = false;
}

function closeDetails() {
  opened.value = null;
  returnToGraph();
}

/** A row clicked: the cursor moves there, and the details with it even when it was there already. */
function onRowClick(commit: KeptCommit) {
  cursor.select(commit.oid);
  if (opened.value) {
    showDetails(commit);
  }
}

/** A commit from the details: selected in the graph when it is a row, and opened beside it when it is not (D12). */
function goToCommit(commit: CommitParent) {
  const index = commits.value.findIndex(candidate => candidate.oid === commit.oid);
  if (index !== -1) {
    cursor.select(commit.oid);
    reveal(index);
  }

  showDetails(commit);
}

function readOpened(commit: OpenedCommit) {
  store.ensureDetail(props.nameWithOwner, commit);
  store.ensureStates(props.nameWithOwner, [commit]);
}

/** The details' keys are theirs: shown, and with nothing over them. A tooltip takes no keys. */
function detailsHaveKeys() {
  return opened.value !== null && !itemOpened.value && !isScreenCovered();
}

/** A parent there is none of does nothing. */
function goToParent(index: number) {
  const parent = opened.value && store.getCommit(props.nameWithOwner, opened.value.oid)?.parents[index];
  if (parent) {
    goToCommit(parent);
  }
}

/**
 * As any item opens; over a list the details stay open under it (CH29). Found by its address, not its number: a fork's
 * commit answers with its upstream's pull request. A commit with none does nothing.
 */
function openPullRequest() {
  const pullRequest = opened.value && store.getState(props.nameWithOwner, opened.value.oid)?.pullRequest;
  const reference = pullRequest && parseItemUrl(pullRequest.url);
  if (reference) {
    openItemReference(reference, 'pullRequest');
  }
}

/** The share giving `width`, within what the graph can be drawn at. */
function getShare(width: number) {
  const minWidth = getCommitGraphWidth(getMinLanes(graph.value?.layout.maxWidth ?? 0));
  return Math.max(minWidth, Math.min(fit.value.maxWidth, width)) / paneWidth.value;
}

function onDividerPointerDown(event: PointerEvent) {
  if (event.button !== 0 || !(event.currentTarget instanceof Element)) {
    return;
  }

  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  dragStart = { x: event.clientX, width: fit.value.width };
  draggedShare.value = getShare(fit.value.width);
}

function onDividerPointerMove(event: PointerEvent) {
  if (dragStart) {
    draggedShare.value = getShare(dragStart.width + event.clientX - dragStart.x);
  }
}

function onDividerPointerUp() {
  if (dragStart && draggedShare.value !== null) {
    if (fit.value.width !== dragStart.width) {
      keptShare.value = draggedShare.value;
    }

    dragStart = null;
    draggedShare.value = null;
  }
}

function onDividerKeydown(event: KeyboardEvent) {
  if (!isSingleKeyShortcut(event)) {
    return;
  }

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      event.preventDefault();
      resizedByKey.value = true;
      moveShareBy(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    case 'Enter':
      event.preventDefault();
      resetShare();
  }
}

/** One lane more or fewer; at a limit nothing changes, so nothing is kept for every other repository. */
function moveShareBy(lanes: number) {
  const share = getShare(getCommitGraphWidth(fit.value.lanes + lanes));
  if (Math.round(share * paneWidth.value) !== fit.value.width) {
    keptShare.value = share;
  }
}

function resetShare() {
  keptShare.value = null;
}
</script>

<template>
  <div :class="css.commitGraphView">
    <div
      ref="scroller"
      :class="[css.commitGraphView_pane, focusReturned && css.commitGraphView_pane_focusReturned]"
      tabindex="0"
      :aria-label="t(l.commitsOf, { name: nameWithOwner })"
      role="region"
      @scroll.passive="onScroll"
      @pointerdown="leaveFoldedRefList"
      @blur="focusReturned = false"
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
        <div
          :class="css.commitGraphView_graph"
          :style="{ '--commit-graph-width': `${fit.width}px` }"
        >
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
                cursorDrawn && row.commit.oid === cursor.selectedKey && css.commitGraphView_row_cursor,
              ]"
              :style="{ top: `${row.index * COMMIT_ROW_HEIGHT}px`, height: `${COMMIT_ROW_HEIGHT}px` }"
              :aria-current="row.commit.oid === cursor.selectedKey ? 'true' : undefined"
              :aria-posinset="row.index + 1"
              :aria-setsize="graph?.endReached ? count : -1"
              @click="onRowClick(row.commit)"
            >
              <CommitRow
                :commit="row.commit"
                :graph-row="row.graphRow"
                :lanes="fit.lanes"
                :folded="fit.lanes < totalLanes"
                :main-lane="graph?.layout.hasMainLane ?? false"
                :refs="refsByOid.get(row.commit.oid) ?? []"
                :state="store.getState(nameWithOwner, row.commit.oid)"
                :now="now"
              />
            </li>
          </ul>
          <div
            :class="css.commitGraphView_divider"
            role="separator"
            aria-orientation="vertical"
            :aria-label="t(l.resizeGraph)"
            :aria-valuenow="fit.lanes"
            :aria-valuemin="getMinLanes(fit.maxLanes)"
            :aria-valuemax="fit.maxLanes"
            :aria-valuetext="lanesFitLabel"
            tabindex="0"
            :data-state="draggedShare === null ? undefined : 'drag'"
            @pointerdown="onDividerPointerDown"
            @pointermove="onDividerPointerMove"
            @pointerup="onDividerPointerUp"
            @pointercancel="onDividerPointerUp"
            @dblclick="resetShare"
            @keydown="onDividerKeydown"
            @blur="resizedByKey = false"
          >
            <div :class="css.commitGraphView_dividerMiddle">
              <span :class="css.commitGraphView_grip" />
              <span
                v-if="draggedShare !== null || resizedByKey"
                :class="css.commitGraphView_lanesFit"
              >
                <MoveHorizontal
                  :class="css.commitGraphView_noteIcon"
                  aria-hidden="true"
                />
                {{ lanesFitLabel }}
              </span>
            </div>
          </div>
        </div>
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
        <p
          v-else-if="offline"
          :class="css.commitGraphView_note"
        >
          <CloudOff
            :class="css.commitGraphView_noteIcon"
            aria-hidden="true"
          />
          {{ t(l.olderWhenOnline) }}
        </p>
      </template>
    </div>
    <CommitRefList
      v-if="refs && hasRefs && opened === null && (!refListFolded || refListOpened)"
      ref="refList"
      :key="nameWithOwner"
      :class="refListFolded && css.commitGraphView_refListOver"
      :name-with-owner="nameWithOwner"
      :refs="refs"
      :now="now"
      @choose="onRefChosen"
      @leave="onRefListLeft"
    />
    <CommitDetails
      v-if="opened && !itemOpened"
      :class="refListFolded && css.commitGraphView_refListOver"
      :name-with-owner="nameWithOwner"
      :oid="opened.oid"
      :refs="refsByOid.get(opened.oid) ?? []"
      :chosen-ref="opened.chosenRef"
      :url="openedUrl"
      :now="now"
      @close="closeDetails"
      @step="cursor.step"
      @open-parent="goToCommit"
      @open-pull-request="openPullRequest"
    />
  </div>
</template>

<style lang="scss" module="css">
.commitGraphView {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.commitGraphView_pane {
  @include focus-ring;

  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.commitGraphView_pane_focusReturned:focus-visible {
  outline: none;
}

// D15: below about 1,200 px the list, and a commit's details with it, open over the graph, leaving its width alone.
.commitGraphView_refListOver {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  background: $color-bg;
  box-shadow: $shadow-popover;
}

.commitGraphView_graph {
  position: relative;
  flex: none;
}

.commitGraphView_rows {
  position: relative;
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

// D17, CH45: a line at the graph's edge, with room to take hold of it either side. It runs the height of the rows, so
// it scrolls with them and stops above the line under them.
.commitGraphView_divider {
  $reach: 4px;

  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--commit-graph-width) - #{$reach});
  z-index: 1;
  width: $reach * 2 + 1px;
  cursor: col-resize;
  outline: none;
  touch-action: none;

  &::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: $reach;
    width: 1px;
    content: '';
    background: $color-border;
  }

  &[data-state='drag']::before,
  &:focus-visible::before {
    left: $reach - 0.5px;
    width: 2px;
    background: $color-accent;
  }
}

// Stays at the middle of the pane as the rows scroll.
.commitGraphView_dividerMiddle {
  position: sticky;
  top: 50%;
}

.commitGraphView_grip {
  position: absolute;
  top: -10px;
  left: 2.5px;
  width: 4px;
  height: 20px;
  background: $color-fg-3;
  border-radius: 2px;
  opacity: 0;
}

.commitGraphView_divider:hover .commitGraphView_grip {
  opacity: 1;
}

.commitGraphView_divider[data-state='drag'] .commitGraphView_grip,
.commitGraphView_divider:focus-visible .commitGraphView_grip {
  background: $color-accent;
  opacity: 1;
}

.commitGraphView_lanesFit {
  position: absolute;
  top: 14px;
  left: 12px;
  display: inline-flex;
  gap: $spacing-6;
  align-items: center;
  padding: $spacing-4 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg;
  white-space: nowrap;
  pointer-events: none;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-md;
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
