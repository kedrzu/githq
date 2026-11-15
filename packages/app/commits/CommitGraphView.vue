<!-- A repository's Commits section (git-client D9, D18, CH3): its commit graph, in any repository the user can see, tracked or not (D11). Opening it opens the graph in `CommitGraphStore` — the kept copy at once, then GitHub asked in the background — and only the rows near the viewport are drawn, so thousands of commits scroll as fast as a hundred. The rows on screen ask for their pull request and CI state; coming within a screen of the last loaded row reads the next page, "Loading older commits…" under the rows meanwhile (CH35), and the first commit of the repository ends the graph with "The beginning of its history" (CH36); offline, what is kept stays and the last row says older commits wait (CH40). An empty repository says so (CH38); with nothing to draw and GitHub in the way the pane says why — offline, paused until a time, GitHub failing or hiding it (`CantBeRead`, first run and loading D6, D12, ES22), staying up while it is asked again — the store asks again by itself when GitHub failed and at the end of a pause, only while this view holds the graph on screen — while a graph already on screen stays, the status bar alone telling it; a first open with nothing kept yet is a skeleton in the graph's shape until the first rows arrive — the branches and tags' where their list will be, the rows' in the pane, no words on screen, and the status bar's segment says "Reading commits" (first run and loading D14, D17, ES21). `J`/`K` or ↓/↑ move a cursor row, kept in view, which starts on the commit open in the panel when it is a row, else on the commit opened last, else on the newest commit of the default branch, else the top row (CH23); a click moves it there. Commits arriving above its row, moved or not, leave that row where it was on screen (D19), a scroll up away; when its commit is gone it moves to its nearest neighbour, like every list, at the same height. A divider sets the graph's share of the pane, a tenth by default and kept on this device: dragged, or by a lane with ←/→, from two lanes to every lane; a double-click or `Enter` resets it, and the lanes that don't fit fold onto the last (D17). Left of the graph, the branches and tags (`CommitRefList`, D15) in a left column of their own width (`RepositoryColumnSplit`), folding away below about 1,200 px of window; `B` or the header's tool (`openRefList`) puts the cursor in their filter, the list opening over the graph from its left when folded. Choosing one with its commit loaded scrolls the graph to it, a third of the way down, with the cursor on it (D12), and opens it in the panel when the panel fits; with its commit not loaded the graph stays and that commit opens (CH16); either way the keys are back on the graph and the list's filter cleared. The section behaves as a list (D16): entering it opens nothing; a click on a row, `Enter` on the cursor's and a chosen ref open the commit as an item (`OpenedCommit`) — in the shell's panel beside the section (`?pane=commit&commit=owner|name|<sha>`), the first added to the history, in place of any item open there, or on its page when the window has no room for the panel (`ItemNavigation.panelFits`). While a commit of this repository is open in the panel, `J`/`K` go on moving the cursor and the panel follows, replacing the address; with no room for the panel they never leave the graph. The address moving the commit — Back and Forward, the panel's `P`/`Shift+P` and its `K`/`J` buttons — moves the cursor onto it when it is a row, into view; while the panel shows a commit that isn't a row (CH16, CH41: a branch force-pushed under it) no row is drawn as the cursor, which `J`/`K` still move from, and a row gone never moves the panel off the commit it shows. The section is the list the opened commit steps through (`ItemNavigation.list`, by `CommitRoutes.formatKey`): on its page `K`/`J`, and where closing it comes back to. With another item open in the panel (a workflow, an issue) the keys are the item's, though a click on a row opens the commit in its place. `Esc` with the folded list open leaves the list, before an open commit closes (`CommitGraphStore.addEscapeTaker`). In a repository's column layout (`refListInColumn`, D14, D15, CH6, CH42) the list lives in the repository's column — this view still holds it and all its state, it just renders there — and the graph has the pane: never folded, never in the way, whatever the window's width. Wherever it renders it is one instance, its filter going with it. A branch's pull request number in the list opens it as any item opens, the list giving way (D15). Left for a run's page with a commit open, Back restores the address, and with it the commit in the panel and under the cursor (D24). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { onWindowResize } from '@nzyme/vue-utils/onWindowResize.js';
import { CloudOff, Flag, GitCommitHorizontal, LoaderCircle, MoveHorizontal } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { useCommands } from '@/commands/useCommands.js';
import CantBeRead from '@/components/CantBeRead.vue';
import EmptyState from '@/components/EmptyState.vue';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { getOpenedItemRoute } from '@/item/itemRoutes.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { useOpenItemReference } from '@/item/useOpenItemReference.js';
import RepositoryColumnSplit from '@/repository/RepositoryColumnSplit.vue';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { useNow } from '@/services/useNow.js';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';
import { getCantBeReadCause } from '@/utils/getCantBeReadCause.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenCovered } from '@/utils/isScreenCovered.js';
import { isSingleKeyShortcut } from '@/utils/isSingleKeyShortcut.js';
import { isScreenKey } from '@/utils/isScreenKey.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import { useRowSelection } from '@/utils/useRowSelection.js';

import { CommitGraphStore } from './CommitGraphStore.js';
import * as l from './CommitGraphView.loc.js';
import CommitRefList from './CommitRefList.vue';
import { CommitRoutes, parseCommitKey } from './commitRoutes.js';
import CommitRow, { COMMIT_ROW_HEIGHT } from './CommitRow.vue';
import CommitsArriving from './CommitsArriving.vue';
import { COMMIT_REF_LIST_TARGET_ID } from './CommitTypes.js';
import type { CommitRef, KeptCommit } from './CommitTypes.js';
import { COMMIT_GRAPH_DEFAULT_SHARE, fitCommitGraph, getCommitGraphWidth, getMinLanes } from './fitCommitGraph.js';
import { groupCommitRefs } from './groupCommitRefs.js';

const props = defineProps<{
  /** `owner/name`. */
  nameWithOwner: string;
  /** The list of branches and tags renders in the repository's column instead of this view's own (D14). */
  refListInColumn?: boolean;
}>();

/** How many rows are drawn above and below the viewport, so a quick scroll shows no gap. */
const OVERSCAN = 8;
/** The name the graph's share of the pane is kept under. */
const GRAPH_PANEL = 'commitGraph';
/** How often the ages move on. */
const AGE_TICK_MS = 30_000;
/** The window's width below which the list of branches and tags folds away (D15). */
const REF_LIST_MIN_WINDOW_WIDTH = 1200;

const store = useService(CommitGraphStore);
const accounts = useService(AccountSession);
const navigation = useService(ItemNavigation);
const route = useRoute();
const router = useRouter();
const openItemReference = useOpenItemReference();
const t = useTranslate();
const now = useNow(AGE_TICK_MS);
const keptShare = useService(LocalPreferences).getPanelShare(GRAPH_PANEL);
const refListBesideId = useId();
const refListOverId = useId();

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

/** The commit this view asked the panel to show, until the address shows it: the cursor's move that asked asks no more. */
let openingOid: string | null = null;
/** Ends this view's hold on the graph it shows: only a graph on screen is read again by itself. */
let releaseGraph: (() => void) | undefined;

const graph = computed(() => store.get(props.nameWithOwner));
const refs = computed(() => graph.value?.refs ?? null);
const repositoryName = computed(() => parseRepositoryName(props.nameWithOwner));
const narrowWindow = computed(() => windowWidth.value < REF_LIST_MIN_WINDOW_WIDTH);
/** In the repository's column the list is always there, folding nothing. */
const refListFolded = computed(() => !props.refListInColumn && narrowWindow.value);
/** The first read runs with no branches or tags yet: their skeleton stands where the list will be (first run and loading D17). */
const refListArriving = computed(() => shown.value === 'loading' && !hasRefs.value);
const refListShown = computed(() => {
  if (!hasRefs.value && !refListArriving.value) {
    return false;
  }

  return !refListFolded.value || refListOpened.value;
});
/** The list in this view's own left column, not the repository's and not over the graph. */
const refListBeside = computed(() => refListShown.value && !refListFolded.value && !props.refListInColumn);
/** Where the list renders: the repository's column, this view's own, or a place in the pane to lie over the graph. */
const refListPlace = computed(() => {
  if (props.refListInColumn) {
    return `#${COMMIT_REF_LIST_TARGET_ID}`;
  }

  return refListFolded.value ? `#${refListOverId}` : `#${refListBesideId}`;
});
// One step behind the place: this view's column mounts after the pane is updated, and the list must find it there.
const refListTarget = ref(refListPlace.value);
watch(
  refListPlace,
  place => {
    refListTarget.value = place;
  },
  { flush: 'post' },
);
const commits = computed((): readonly KeptCommit[] => graph.value?.commits ?? []);
const offline = computed(() => {
  const freshness = store.getFreshness(props.nameWithOwner);
  return freshness.kind === 'stale' && freshness.reason === 'offline';
});
const hasRefs = computed(() => (refs.value?.branches.length ?? 0) + (refs.value?.tags.length ?? 0) > 0);
const count = computed(() => commits.value.length);
/** An item is opened over the section, in the panel: a commit of this repository or anything else. */
const itemOpened = computed(() => getOpenedItemRoute(route) !== null);
/**
 * The oid of this repository's commit open in the panel beside the section (`?pane=commit…`) — its full oid once
 * GitHub named a short sha —; `null` with none, an item of another kind, or another repository's commit.
 */
const shownOid = computed(() => {
  const opened = CommitRoutes.getOpened(route);
  if (!opened || opened.onPage) {
    return null;
  }

  const { owner, name, oid } = opened.reference;
  if (`${owner}/${name}`.toLowerCase() !== props.nameWithOwner.toLowerCase()) {
    return null;
  }

  const rev = oid.toLowerCase();
  return store.resolveOid(props.nameWithOwner, rev) ?? rev;
});
/** Another item is opened over the section (CH29): a workflow, an issue. The keys are its own; a click on a row still opens the commit. */
const otherItemOpened = computed(() => itemOpened.value && shownOid.value === null);
/** The commit under the cursor: not `selectFirst`, which would follow the newest row and break D19. */
const cursor = useRowSelection({
  rows: commits,
  getKey: commit => commit.oid,
  reveal: oid => reveal(commits.value.findIndex(commit => commit.oid === oid)),
  open: commit => openCommit(commit.oid),
  enabled: () => !otherItemOpened.value,
});
/** The cursor is drawn on its row, unless the panel shows a commit it isn't on (CH16, CH41). */
const cursorDrawn = computed(() => shownOid.value === null || shownOid.value === cursor.selectedKey);
/** Each loaded row's key, as an opened commit steps through them (`ItemNavigation.list`). */
const steps = computed(() =>
  commits.value.map(commit => CommitRoutes.formatKey({ ...repositoryName.value, oid: commit.oid })),
);
/** The keys of the cursor's neighbours: what the panel's `K` and `J` buttons open. */
const around = computed(() => {
  const index = commits.value.findIndex(commit => commit.oid === cursor.selectedKey);
  return index === -1 ? null : { previous: steps.value[index - 1] ?? null, next: steps.value[index + 1] ?? null };
});
/** The section's address with no commit open over it: where closing one comes back to. */
const listPath = computed(
  () => router.resolve({ path: route.path, query: CommitRoutes.getQuery(route.query, null) }).fullPath,
);
/** What stands between GitHub and the graph, whether or not anything is on screen; told while it is asked again. */
const unreadable = computed(() =>
  getCantBeReadCause({
    freshness: store.getFreshness(props.nameWithOwner),
    retry: () => store.open(props.nameWithOwner),
    url: getGitHubUrl(props.nameWithOwner),
  }),
);
/** What the section shows: the graph, or before it, its skeleton, the empty repository, or why nothing arrives. */
const shown = computed(() => {
  const current = graph.value;
  if (current && current.commits.length > 0) {
    return 'graph';
  }

  if (unreadable.value) {
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
const refsByOid = computed(() => groupCommitRefs(refs.value));

// The graph is asked of GitHub only through the store, which answers from its kept copy first, and held while shown.
// Another account signed in has emptied the store: the graph is held and opened again for them.
watch(
  [() => props.nameWithOwner, () => accounts.current],
  ([nameWithOwner]) => {
    releaseGraph?.();
    releaseGraph = store.hold(nameWithOwner);
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

// The cursor starts on the commit open in the panel when it is a row — Back from a run's page restores the address, and
// with it the commit (D24) —, else on the one opened last (closed from its page), else on the newest commit of the
// default branch, else the top row (CH23). When commits arrive above its row, moved or not, the row keeps its place on
// screen (D19). When its commit is gone (a branch force-pushed), `useRowSelection` has already moved it to a neighbour,
// which takes the gone commit's height: hence the keys before and after, not just the one now.
watch(
  [commits, () => cursor.selectedKey],
  ([next, oid], [previous, previousOid]) => {
    if (next === previous) {
      return;
    }

    if (oid === null) {
      const start = findRow(next, shownOid.value) ?? findRow(next, getLastOpenedOid()) ?? getStart(next);
      if (start) {
        cursor.select(start.oid);
        // Mounted, the scroller isn't there yet: `onMounted` brings the row into view.
        reveal(next.indexOf(start));
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

// With a commit of this repository open in the panel — or on its way there —, the panel follows the cursor the user
// moves, in place of the address. A row gone moves the cursor too, and that the panel doesn't follow: the commit it shows
// may be the one gone (CH41). With no room for the panel the keys never leave the graph.
watch(
  () => cursor.selectedKey,
  (oid, previous) => {
    const showing = shownOid.value ?? openingOid;
    if (
      oid === null ||
      showing === null ||
      oid === showing ||
      oid === openingOid ||
      !navigation.panelFits ||
      !commits.value.some(commit => commit.oid === previous)
    ) {
      return;
    }

    openCommit(oid);
  },
);

// The commit the address opens moved — Back, Forward, the panel's `P`, its `K`/`J` buttons —: the cursor goes with it
// when it is a row, into view, unless the cursor has moved on to a commit asked for since. A commit that isn't a row
// (CH16, CH41) draws no row as the cursor.
watch(shownOid, oid => {
  const index = oid === null ? -1 : commits.value.findIndex(commit => commit.oid === oid);
  if (oid === null || index === -1 || oid === cursor.selectedKey || (openingOid !== null && openingOid !== oid)) {
    return;
  }

  cursor.select(oid);
  reveal(index);
});

// What an opened commit steps through — on its page `K`/`J`, in the panel its buttons, the cursor's neighbours —, and
// where closing it comes back to, by its name.
watch(
  [steps, around, listPath, () => t(l.title)],
  ([stepKeys, neighbours, path, title]) =>
    navigation.setList({ kind: 'commit', path, title, steps: stepKeys, stepOf: new Map(), around: neighbours }),
  { immediate: true },
);

useCommands(() => [
  { id: 'commits.next', title: t(l.next), section: 'view', key: 'J', otherKeys: ['ArrowDown'], menu: false },
  { id: 'commits.previous', title: t(l.previous), section: 'view', key: 'K', otherKeys: ['ArrowUp'], menu: false },
  {
    id: 'commits.refList',
    title: t(l.findRef),
    section: 'view',
    key: 'B',
    menu: false,
    when: () => !otherItemOpened.value && !isScreenCovered(),
    run: () => void openRefList(),
  },
  { id: 'commits.open', title: t(l.openCommit), section: 'view', key: 'Enter', menu: false },
]);

onWindowResize(() => {
  windowWidth.value = window.innerWidth;
});

// With a commit open in the panel the keys are the commit's (`OpenedCommit`), but the list over the graph leaves first.
const removeEscapeTaker = store.addEscapeTaker(() => {
  if (!refListOpened.value) {
    return false;
  }

  refList.value?.leave();
  return true;
});

onWindowEvent('keydown', event => {
  // An item opened over the section has Esc: a commit gives it to the list over the graph first (above).
  if (!isScreenKey(event) || itemOpened.value || event.key !== 'Escape' || isLayerOpen()) {
    return;
  }

  if (refListOpened.value) {
    event.preventDefault();
    refList.value?.leave();
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
  // Mounted with the graph in memory, the cursor was placed during setup, before there was a scroller.
  const placed = commits.value.findIndex(commit => commit.oid === cursor.selectedKey);
  if (placed !== -1) {
    reveal(placed);
  }

  observer = new ResizeObserver(() => {
    const before = { top: element.scrollTop, height: viewportHeight.value };
    measure(element);
    // A shorter pane (the window shrunk): a cursor row that was in view stays in view.
    if (element.clientHeight < before.height) {
      revealCursor(before);
    }
  });
  observer.observe(element);
});

onBeforeUnmount(() => {
  removeEscapeTaker();
  observer?.disconnect();
  releaseGraph?.();
  // The list stays what an opened commit steps through; its cursor goes with it.
  const { list } = navigation;
  if (list?.kind === 'commit') {
    navigation.setList({ ...list, around: null });
  }
});

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

/** Reveals the cursor's row when it was in view in `before`, and leaves a scroll that had left it alone. */
function revealCursor(before: { top: number; height: number }) {
  const index = commits.value.findIndex(commit => commit.oid === cursor.selectedKey);
  const top = index * COMMIT_ROW_HEIGHT;
  if (index !== -1 && top >= before.top && top + COMMIT_ROW_HEIGHT <= before.top + before.height) {
    reveal(index);
  }
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

  // Folded, it opens over the graph only; the panel stays as it is.
  refListOpened.value = refListFolded.value;
  await nextTick();
  refList.value?.focusFilter();
}

/**
 * D12: to the commit, when it is loaded — its row a third of the way down the pane, drawn once scrolled to — whose next
 * `Enter` is on it (CH26), opened in the panel when it fits; otherwise the graph stays where it is and the commit opens,
 * in the panel or on its page (CH16). Either way back to the graph, the list's filter cleared.
 */
function onRefChosen(chosen: CommitRef) {
  store.noteChosenRef(props.nameWithOwner, chosen);
  const index = commits.value.findIndex(commit => commit.oid === chosen.oid);
  if (index === -1) {
    openCommit(chosen.oid);
  } else {
    cursor.select(chosen.oid);
    if (navigation.panelFits) {
      openCommit(chosen.oid);
    }

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
  scroller.value?.focus({ preventScroll: true });
}

/** As from a row, the list done with first: the keys are on the graph when the item closes, its filter cleared. */
function onRefListPullRequest(reference: ItemReference) {
  refList.value?.leave();
  openItemReference(reference, 'pullRequest');
}

/** A row clicked: the cursor moves there, and the commit opens, in place of any item open in the panel. */
function onRowClick(commit: KeptCommit) {
  cursor.select(commit.oid);
  openCommit(commit.oid);
}

/**
 * The commit `oid` of this repository opened as an item, as lists open theirs: in the panel beside the section when it
 * fits — the first added to the history, one in place of the commit open there replacing it; one asked for while
 * another is still on its way takes that one's place —, else on its page.
 */
function openCommit(oid: string) {
  const reference = { ...repositoryName.value, oid };
  if (!navigation.panelFits) {
    void router.push(CommitRoutes.getPagePath(reference));
    return;
  }

  if (oid === shownOid.value) {
    return;
  }

  const location = { path: route.path, query: CommitRoutes.getQuery(route.query, reference) };
  openingOid = oid;
  void (shownOid.value === null ? router.push(location) : router.replace(location)).finally(() => {
    if (openingOid === oid) {
      openingOid = null;
    }
  });
}

/** The commit the cursor starts on: the default branch's tip when it is loaded, else the top row. */
function getStart(rows: readonly KeptCommit[]) {
  const known = refs.value;
  const tip = known?.branches.find(branch => branch.name === known.defaultBranch)?.oid;
  return rows.find(commit => commit.oid === tip) ?? rows[0];
}

function findRow(rows: readonly KeptCommit[], oid: string | null) {
  return oid === null ? undefined : rows.find(commit => commit.oid === oid);
}

/** The oid of the commit opened last, when it is this repository's (`ItemNavigation.lastOpenedId`). */
function getLastOpenedOid() {
  const key = navigation.lastOpenedId;
  const reference = key === null ? null : parseCommitKey(key);
  return reference && `${reference.owner}/${reference.name}`.toLowerCase() === props.nameWithOwner.toLowerCase()
    ? reference.oid.toLowerCase()
    : null;
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
  <RepositoryColumnSplit :shown="refListBeside">
    <template #column>
      <div
        :id="refListBesideId"
        :class="css.commitGraphView_refListBeside"
      />
    </template>
    <div :class="css.commitGraphView">
      <div
        ref="scroller"
        :class="css.commitGraphView_pane"
        tabindex="0"
        data-screen-keys
        :aria-label="t(l.commitsOf, { name: nameWithOwner })"
        role="region"
        @scroll.passive="onScroll"
        @pointerdown="leaveFoldedRefList"
      >
        <template v-if="shown === 'loading'">
          <span :class="css.commitGraphView_arrivingLabel">{{ t(l.loading) }}</span>
          <CommitsArriving place="graph" />
        </template>
        <CantBeRead
          v-else-if="shown === 'unavailable' && unreadable"
          place="screen"
          :cause="unreadable"
          :thing="unreadable.kind === 'hidden' ? nameWithOwner : t(l.theCommits)"
          :plural="unreadable.kind !== 'hidden'"
        />
        <EmptyState
          v-else-if="shown === 'empty'"
          :icon="GitCommitHorizontal"
          :title="t(l.emptyTitle)"
          :detail="t(l.emptyDetail, { name: nameWithOwner })"
          :fact="t(l.emptyFact)"
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
                  @open-pull-request="openItemReference($event, 'pullRequest')"
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
      <div
        :id="refListOverId"
        :class="css.commitGraphView_refListOverPlace"
      />
      <Teleport
        v-if="refListShown"
        :to="refListTarget"
        defer
      >
        <CommitRefList
          v-if="refs && hasRefs"
          ref="refList"
          :key="nameWithOwner"
          :class="refListFolded && css.commitGraphView_refListOver"
          :name-with-owner="nameWithOwner"
          :refs="refs"
          :refs-complete="graph?.refsComplete ?? false"
          :now="now"
          @choose="onRefChosen"
          @leave="onRefListLeft"
          @open-pull-request="onRefListPullRequest"
        />
        <CommitsArriving
          v-else
          place="refs"
        />
      </Teleport>
    </div>
  </RepositoryColumnSplit>
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
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  // Focused, it draws nothing: the cursor row shows where the keys go.
  outline: none;
}

// Nothing of its own: what it holds lies over the graph.
.commitGraphView_refListOverPlace {
  display: contents;
}

.commitGraphView_refListBeside {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

// D15: below about 1,200 px the list opens over the graph from its left, leaving its width alone.
.commitGraphView_refListOver {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  // The repository column's width.
  width: var(--column-split-width);
  max-width: 100%;
  background: $color-bg;
  border-right: 1px solid $color-border;
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
  @include row-surface;

  position: absolute;
  right: 0;
  left: 0;
  cursor: pointer;
  // CH54: the surface spans the graph too, with room on the left for the first lane's ring; the lanes are drawn over it,
  // unbroken from row to row.
  --row-surface-inset: #{$spacing-2} #{$spacing-8} #{$spacing-2} #{$spacing-4};

  // The dot's ring (`CommitGraphCell`): soft under the mouse.
  &:hover {
    --commit-graph-ring-color: #{$color-fg-3};
    --commit-graph-ring-opacity: 0.5;
  }
}

// D18.
.commitGraphView_row_odd {
  background: $color-row-stripe;
}

// As a list's selected row.
.commitGraphView_row_cursor {
  @include row-selected;

  // The dot's ring in the accent, hovered or not: 3:1 on `$color-sel` (`tokens.test.ts`, `accent`).
  &,
  &:hover {
    --commit-graph-ring-color: #{$color-accent};
    --commit-graph-ring-opacity: 1;
  }
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

// The skeleton has no words on screen; screen readers get this one line (first run and loading D10).
.commitGraphView_arrivingLabel {
  @include visually-hidden;
}
</style>
