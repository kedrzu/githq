<!-- A pull request's review (D24): the toolbar, the list of files on the left and the diff filling the rest, every file one after another under its pinned header. Files arrive and diffs are computed while it shows, none of it moving what is being read (D7): a jump (a click in the list, `[` `]`) lands its file's header exactly at the top and holds it there through files arriving above, the layout and the whitespace setting; a line being read stays on screen through them too. A file that fails, is too large or binary says so in place and the others go on (D35). Lock files, generated and very large files start as a header, nothing of them fetched until opened; Space or a click on the header opens the file or collapses it (D8). `V` or the header's button sets the file's viewed mark, GitHub's own (D9), which collapses the file to its header in place, or with viewed files hidden the next file takes its place, and with all of them viewed the diff says so. Files selected in the list (x, { }, ⇧click, ⌘click, D10) take `V` together, in one request. `/` filters (D11): files filtered away leave the diff too, the reader moving on to the next one left. A gap's Show 20 and Show all hold the line under it where it is, the lines coming above it (D6, D7). Every thread shows where it belongs (D12, D13, D30), a file with an unresolved one is never hidden as viewed (D15), one gone from the diff has an entry of its own, and N ⇧N walk them, the open ones first, each landing held in place and opened (D7, D32). A pull request of a stack has the stack above the files, in a left column that scrolls as one: the rows go by and a bar stays pinned, the files' head under it (D25). `J` `K` walk the list it was opened from as in an opened pull request (D16), `[` `]` being the files; a row or a square of the stack and the command menu go to any of its pull requests, always replacing the address, so Back returns to where the review was entered (D2). ⌘B hides the left column and ⌥⌘B shows the pull request's conversation at the right (D5, D26), and a review's "2 threads in files" there lands on the first of them as N does. GitHub's allowance running out pauses the missing files, which carry on by themselves at its reset, and the status bar says so; files GitHub took the viewed mark off since the last visit are named in a line that goes once the first of them has been read (D35). What the user did here is kept for this pull request, and it opens where they left it, by the line, or the first time on its first file not viewed nor collapsed (D7, D14, D16), the status bar saying so until the first move (CR20, CR25, CR26). While the viewer has a draft review on it, a toolbar at the foot of the diff says how many comments wait and leads to submitting or discarding it (D28, D33). A line's number or `C` opens a comment box under it (D32), a drag or ⇧click on the numbers making it a range (CR73): `C` takes the line of the thread N and ⇧N are at while that is on screen, or else the first line on screen. Nothing moves for it unless the box wouldn't fit on screen, by as little as it takes (D7). A box scrolled out of the list's window takes the keys back when it comes back into it. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CircleAlert,
  CircleCheck,
  Equal,
  Eye,
  FileSearch,
  ChevronDown,
  ChevronUp,
  FoldVertical,
  GitPullRequest,
  ListChecks,
  ListFilter,
  MessageSquare,
  MessageSquarePlus,
  Send,
  PanelLeft,
  PanelRight,
  Pause,
  Trash2,
  UnfoldVertical,
} from 'lucide-vue-next';
import { computed, nextTick, onScopeDispose, shallowRef, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { AuthStore } from '@/auth/AuthStore.js';
import type { Command } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import Kbd from '@/components/Kbd.vue';
import { formatItemReference, getItemPagePath, getItemReference, getReviewPath } from '@/item/itemRoutes.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { useItemStack } from '@/item/useItemStack.js';
import { getStackMembers } from '@/store/stacks/getStackMembers.js';
import { useItemWalk } from '@/item/useItemWalk.js';
import { useOpenedItem } from '@/item/useOpenedItem.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import type { Freshness } from '@/sync/Freshness.js';
import { ReloadHolds } from '@/sync/ReloadHolds.js';
import { formatTime } from '@/utils/formatTime.js';
import { goBack } from '@/utils/goBack.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';

import AnchoredList from './AnchoredList.vue';
import type { AnchoredListExposed } from './AnchoredList.vue';
import {
  clampCommentRange,
  COMMENT_BOX_HEIGHT,
  estimateReviewRowHeight,
  findCommentLine,
  findReplacementRow,
  getDistanceLinesToShow,
  getGapLinesToShow,
  getReviewCommentKey,
  getReviewHeaderKey,
  getReviewPlacePath,
  getReviewPosition,
  getReviewRowPath,
  getReviewThreadKey,
} from './buildReviewRows.js';
import type {
  ReviewCommentLine,
  ReviewDistanceRow,
  ReviewFileEndRow,
  ReviewGapRow,
  ReviewRow,
  ReviewThreadRow,
} from './buildReviewRows.js';
import type { DiffLineSide } from './diff/buildDiffRows.js';
import { getReviewOwnThreads } from './conversation/getReviewOwnThreads.js';
import ReviewConversation from './conversation/ReviewConversation.vue';
import { groupReviewFiles } from './groupReviewFiles.js';
import ReviewDiffRow from './ReviewDiffRow.vue';
import ReviewFileList from './ReviewFileList.vue';
import ReviewLostViewedBar from './ReviewLostViewedBar.vue';
import ReviewPendingToolbar from './ReviewPendingToolbar.vue';
import { ReviewFiles } from './ReviewFiles.js';
import { ReviewScreenFreshness } from './ReviewScreenFreshness.js';
import ReviewStack from './ReviewStack.vue';
import ReviewStackStrip from './ReviewStackStrip.vue';
import type { PullRequestFiles, ReviewFile, ReviewFileState } from './ReviewFiles.js';
import { countThreads } from './threads/countThreads.js';
import { findThreadFromRow, listWalkedThreads } from './threads/walkThreads.js';
import ReviewToolbar from './ReviewToolbar.vue';
import * as l from './ReviewView.loc.js';
import { useReviewPosition } from './useReviewPosition.js';
import type { ReviewArrival } from './useReviewPosition.js';
import { useReviewRows } from './useReviewRows.js';
import type { ReviewThreadPlacements } from './useReviewRows.js';
import { createFileFilter } from './utils/createFileFilter.js';
import type { FileFilter, FileFilterInput } from './utils/createFileFilter.js';
import { getFailureText } from './utils/getFailureText.js';
import { getLandingFreshness } from './utils/getLandingFreshness.js';
import { getReviewFreshness } from './utils/getReviewFreshness.js';
import { getReviewPlaceFreshness } from './utils/getReviewPlaceFreshness.js';
import type { CommentedLines } from './utils/isLineCommented.js';
import { getPendingComments } from './writing/getPendingComments.js';
import ReviewCommentRow from './writing/ReviewCommentRow.vue';
import ReviewDiscardDialog from './writing/ReviewDiscardDialog.vue';
import ReviewSubmitDialog from './writing/ReviewSubmitDialog.vue';
import type { ReviewCommentTarget, ReviewCommentWay } from './writing/ReviewWriting.js';

const props = defineProps<{
  reference: ItemReference;
}>();

const WAITING: ReviewFileState = { kind: 'waiting' };
const NO_FILTER: FileFilterInput = { pattern: '', regex: false };
const NO_FILES: ReadonlySet<string> = new Set();
/** A jump to a thread never lands higher than this under the top: the pinned header and a little air. */
const THREAD_MIN_OFFSET = 46;
const NO_TARGETS: readonly ReviewCommentTarget[] = [];
const IDLE_FINISH = { kind: 'idle' } as const;
/** Whether `⌘↵` of a comment box starts a draft with none open, rather than sends at once (D17). The setting comes with M7. */
const COMMENT_DRAFT_FIRST = false;

const t = useTranslate();
const accounts = useService(AccountSession);
const auth = useService(AuthStore);
const holds = useService(ReloadHolds);
const reviewFiles = useService(ReviewFiles);
const preferences = useService(LocalPreferences);
const screenFreshness = useService(ReviewScreenFreshness);
const details = useService(ItemDetailStore);
const items = useService(ItemStore);
const navigation = useService(ItemNavigation);
const router = useRouter();

const opened = useOpenedItem({ reference: () => props.reference });
// D2: walking stays in the review, and an issue has none: the list's issues are stepped over.
const walk = useItemWalk({
  id: () => opened.id,
  stopsAt: id => details.getItem(id)?.kind === 'pullRequest',
});
const stack = useItemStack(() => opened.item);
// In a review `K`/`J` go through its stack's pull requests and only then on along the list, where a collapsed stack is one
// step: going through a stack in a row is what a review is for (D16). Opened by its address there is no list to walk,
// stack or not: its map goes to the others.
const stackIds = computed(() => getStackMembers(stack.value?.pips ?? []).map(pip => pip.pullRequest.id));
const stackIndex = computed(() =>
  opened.id === null || walk.position === null ? -1 : stackIds.value.indexOf(opened.id),
);
const nextPullRequest = computed(
  () => (stackIndex.value === -1 ? null : stackIds.value[stackIndex.value + 1]) ?? walk.neighbours.next,
);
const previousPullRequest = computed(
  () => (stackIndex.value === -1 ? null : stackIds.value[stackIndex.value - 1]) ?? walk.neighbours.previous,
);
const walkPosition = computed(() =>
  stackIndex.value === -1 ? walk.position : { index: stackIndex.value + 1, count: stackIds.value.length },
);
const files = shallowRef<PullRequestFiles | null>(reviewFiles.open(props.reference));
const list = useTemplateRef<AnchoredListExposed>('list');
const fileList = useTemplateRef<InstanceType<typeof ReviewFileList>>('fileList');
const diffColumn = useTemplateRef<HTMLElement>('diffColumn');
const leftColumn = useTemplateRef<HTMLElement>('leftColumn');
const layout = preferences.reviewLayout;
const hideWhitespace = preferences.reviewHideWhitespace;
const fileListHidden = preferences.reviewFileListHidden;
const conversationShown = preferences.reviewConversationShown;
const threadsInCollapsed = preferences.reviewThreadsInCollapsed;
const selected = shallowRef<ReadonlySet<string>>(new Set());
/** The thread N and ⇧N are at. Its row may be scrolled out of the list, and it is still the one. */
const focusedThread = shallowRef<string | null>(null);
/** The left column is off its top: the stack's bar shows over the rows going by (D25). */
const leftScrolled = shallowRef(false);
/** Still on its way to where it opens: see {@link useReviewPosition}. */
const landing = shallowRef(true);
/** Why it opened where it did, for the status bar, until the first move: `landing` is over long before that. */
const arrival = shallowRef<ReviewArrival | null>(null);
/** The comment box the keys are in; it takes them back when its row returns to the list's window. */
const focusedBox = shallowRef<string | null>(null);
/** The box sent last, which takes the keys back if GitHub refuses it. */
const sentBox = shallowRef<string | null>(null);
/** A range being dragged on the lines' numbers (CR73). */
const commentDrag = shallowRef<{ path: string; side: DiffLineSide; from: number; to: number } | null>(null);
const submitOpen = shallowRef(false);
const discardOpen = shallowRef(false);

const hideViewed = computed({
  get: () => files.value?.hideViewed ?? false,
  set: hide => files.value?.setHideViewed(hide),
});
const allFiles = computed(() => files.value?.files ?? []);
const writing = computed(() => files.value?.writing ?? null);
const commentTargets = computed(() => writing.value?.targets ?? NO_TARGETS);
const commentPaths = computed(() => new Set(commentTargets.value.map(target => target.path)));
/** By file: what is being written on, for its lines to be tinted. */
const commentedLines = computed(() => {
  const byPath = new Map<string, CommentedLines>();
  function add(path: string, side: DiffLineSide, start: number, end: number) {
    byPath.set(path, [...(byPath.get(path) ?? []), { side, start, end }]);
  }

  for (const { id, path, side, startLine, line } of commentTargets.value) {
    if (canEdit(id)) {
      add(path, side, startLine ?? line, line);
    }
  }

  const drag = commentDrag.value;
  if (drag) {
    add(drag.path, drag.side, Math.min(drag.from, drag.to), Math.max(drag.from, drag.to));
  }

  return byPath;
});
const filterInput = computed(() => files.value?.filter ?? NO_FILTER);
const typedFilter = computed(() => createFileFilter(filterInput.value));
// A regular expression that doesn't compile, often just not finished, leaves the list as it was (CR28).
const filter = computed<FileFilter>(previous =>
  typedFilter.value.kind === 'invalid' ? (previous ?? { kind: 'off' }) : typedFilter.value,
);
const matchedFiles = computed(() => {
  const current = filter.value;
  return current.kind === 'on' ? allFiles.value.filter(file => current.matches(file.path)) : allFiles.value;
});
// By its own `threadPlacements`: `useReviewRows` publishes them first, and reads `ordered` right after.
const placements = shallowRef<ReviewThreadPlacements>({ byFile: new Map(), goneEntries: [] });
// Apart: nothing downstream of `goneFiles` is to be rebuilt by what doesn't change them.
const listEnd = computed(() => files.value?.listEnd ?? 'growing');
const goneFiles = computed(() => {
  // A comment being written on a file a push took away stays in sight, the text being all the reader has of it.
  const unlisted =
    listEnd.value === 'growing'
      ? []
      : [...commentPaths.value].filter(path => !allFiles.value.some(file => file.path === path));
  return [...new Set([...placements.value.goneEntries, ...unlisted])].map((path): ReviewFile => ({
    path,
    previousPath: null,
    changeType: 'DELETED',
    additions: 0,
    deletions: 0,
    viewed: 'UNVIEWED',
    gone: { kind: listEnd.value === 'certain' ? 'notInDiff' : 'notListed' },
  }));
});
const openThreads = computed(() => {
  const counts = new Map<string, number>();
  for (const [path, placed] of placements.value.byFile) {
    const { open, outdated, lineGone } = countThreads(placed);
    if (open + outdated + lineGone > 0) {
      counts.set(path, open + outdated + lineGone);
    }
  }

  return counts;
});
// A past discussion stays findable: a file whose threads are all resolved shows how many, in grey (D27).
const resolvedThreads = computed(() => {
  const counts = new Map<string, number>();
  for (const [path, placed] of placements.value.byFile) {
    const { open, outdated, lineGone, resolved } = countThreads(placed);
    if (resolved > 0 && open + outdated + lineGone === 0) {
      counts.set(path, resolved);
    }
  }

  return counts;
});
const reviewThreads = computed(() => getReviewOwnThreads(placements.value));
const groups = computed(() => {
  const current = filter.value;
  const gone = current.kind === 'on' ? goneFiles.value.filter(file => current.matches(file.path)) : goneFiles.value;
  // A file with an unresolved thread stays: a colleague's comment on it would appear nowhere else (D15). So does one with a
  // comment being written.
  const shown = hideViewed.value
    ? matchedFiles.value.filter(
        file => file.viewed !== 'VIEWED' || openThreads.value.has(file.path) || commentPaths.value.has(file.path),
      )
    : matchedFiles.value;
  return groupReviewFiles([...shown, ...gone]);
});
// A regular expression can hang the tab: written only by what comes after it has run over the whole list, in this getter.
watch(
  () => {
    void groups.value;
    return files.value?.listComplete && typedFilter.value.kind !== 'invalid' ? filterInput.value : null;
  },
  evaluated => {
    if (evaluated) {
      files.value?.keepFilter(evaluated);
    }
  },
  { immediate: true },
);
const ordered = computed(() => groups.value.flatMap(group => group.files));
const filterOn = computed(() => filter.value.kind === 'on');
// While a filter is on the list is flat, each file followed by its folder (D27).
const listGroups = computed(() =>
  filterOn.value && ordered.value.length > 0 ? [{ folder: null, files: ordered.value }] : groups.value,
);
const allPaths = computed(() =>
  groupReviewFiles([...allFiles.value, ...goneFiles.value]).flatMap(group => group.files.map(file => file.path)),
);
const filterPattern = computed({
  get: () => filterInput.value.pattern,
  set: pattern => files.value?.setFilter({ pattern, regex: filterInput.value.regex }),
});
const filterRegex = computed({
  get: () => filterInput.value.regex,
  set: regex => files.value?.setFilter({ pattern: filterInput.value.pattern, regex }),
});
const currentPath = computed(() => {
  const landingOn = landing.value ? files.value?.position : null;
  if (landingOn) {
    return getReviewPlacePath(landingOn.place);
  }

  const anchor = list.value?.anchor;
  return anchor ? getReviewRowPath(anchor.key) : (ordered.value[0]?.path ?? null);
});
const { rows, threadPlacements } = useReviewRows({
  files,
  ordered,
  layout,
  hideWhitespace,
  currentPath,
  threadsInCollapsed,
  commentTargets,
});
watch(threadPlacements, next => (placements.value = next), { flush: 'sync', immediate: true });
useReviewPosition({ files, rows, ordered, order: allPaths, list, landing, arrival });
const githubUrl = computed(() => {
  const { owner, name, number } = props.reference;
  return `https://github.com/${owner}/${name}/pull/${number}/files`;
});
/** The file in view, unless it is a gone one's entry, which can't be marked, selected or collapsed. */
const currentFile = computed(() => {
  const file = ordered.value.find(({ path }) => path === currentPath.value);
  return file && !file.gone ? file : null;
});
const branches = computed(() => (opened.item?.kind === 'pullRequest' ? opened.item : null));
const detail = computed(() => (opened.detail?.kind === 'pullRequest' ? opened.detail : null));
const pendingReview = computed(() => branches.value?.pendingReview ?? null);
const finish = computed(() => writing.value?.finish ?? IDLE_FINISH);
const pendingComments = computed(() => getPendingComments(files.value?.threads ?? []));
const submission = computed({
  get: () => writing.value?.submission ?? { event: 'COMMENT' as const, body: '' },
  set: choice => writing.value?.setSubmission(choice),
});
const lostViewed = computed(() => files.value?.lostViewed ?? NO_FILES);
/** The threads N and ⇧N walk (CR15). */
const walkedThreads = computed(() => listWalkedThreads(rows.value));
/** What the line about a push names, in the list's order. */
const lostViewedPaths = computed(() =>
  files.value?.lostViewedNotice ? allPaths.value.filter(path => lostViewed.value.has(path)) : [],
);
const otherStackPullRequests = computed((): PullRequestItem[] => {
  const others: PullRequestItem[] = [];
  for (const pip of stack.value?.pips ?? []) {
    if (pip.kind !== 'missing' && pip.pullRequest.id !== opened.id) {
      others.push(pip.pullRequest);
    }
  }

  return others;
});

const openedAt = performance.now();
let firstRowMeasured = false;
/** Where ⇧click selects from: the file last selected on its own. */
let selectionStart: string | null = null;
/** The row under lines being expanded, at where it is on screen: it stays there once they are in. */
let heldInExpanding: { key: string; offset: number } | null = null;
const walkedBy = navigation.takeReviewWalk(formatItemReference(props.reference));

// The text is safe on disk, but a reload under a typing hand would take the box from it.
onScopeDispose(holds.holdWhile(() => writing.value?.hasText ?? false));

// Once, when the diff first shows: PageDown, Space and the arrows then scroll it at once. By then the user may be in a
// field, like the command palette's, which nothing here takes them out of.
const stopFocusing = watch(
  list,
  exposed => {
    if (exposed) {
      stopFocusing();
      if (!document.activeElement || document.activeElement === document.body) {
        exposed.focus();
      }
    }
  },
  { flush: 'post' },
);

// Signed in again as someone else, this is their read of the pull request.
watch(
  () => accounts.current,
  () => {
    files.value = reviewFiles.open(props.reference);
    landing.value = true;
    arrival.value = null;
  },
);

// The address of an issue's number: the item's own page, as GitHub redirects.
watch(
  () => opened.item?.kind,
  kind => {
    if (kind === 'issue') {
      void router.replace(getItemPagePath(props.reference, 'issue'));
    }
  },
  { immediate: true },
);

// What's in view is fetched next, however the user got there (D35). Moving on from a file that lost its viewed mark has
// read the first of them, and the line naming them has done its work.
watch(currentPath, (path, previous) => {
  if (path !== null) {
    files.value?.prioritize(path);
  }

  if (previous !== null && lostViewed.value.has(previous)) {
    files.value?.dismissLostViewedNotice();
  }
});

onScopeDispose(
  screenFreshness.show(() => {
    if (selected.value.size > 0) {
      return { kind: 'filesSelected' };
    }

    const freshness: Freshness = files.value ? getReviewFreshness(files.value) : { kind: 'partial' };
    const walked = walkedThreads.value;
    const at = walked.findIndex(row => row.placement.thread.id === focusedThread.value);
    if (at !== -1) {
      return getReviewPlaceFreshness(freshness, {
        kind: 'threadPosition',
        position: at + 1,
        total: walked.length,
        open: walked.filter(row => !row.placement.thread.isResolved).length,
      });
    }

    return arrival.value
      ? getReviewPlaceFreshness(
          freshness,
          getLandingFreshness({
            arrival: getShownArrival(arrival.value),
            number: props.reference.number,
            files: allFiles.value,
            changedFiles: files.value?.changedFiles ?? null,
            walkedBy,
          }),
        )
      : freshness;
  }),
);

// Runs before the list gets the rows, when `anchor` is still the row being read: if that row goes with them, its
// counterpart takes its place once they are in.
watch(rows, (next, previous) => {
  const held = heldInExpanding;
  if (held) {
    heldInExpanding = null;
    void nextTick(() => list.value?.jumpTo(held.key, held.offset));
    return;
  }

  // On its way, its own place decides.
  if (landing.value) {
    return;
  }

  const anchor = list.value?.anchor;
  const replacement = anchor
    ? findReplacementRow({ key: anchor.key, offset: anchor.offset, previous, next, order: allPaths.value })
    : null;
  if (replacement) {
    void nextTick(() => list.value?.jumpTo(replacement.row.key, replacement.offset));
  }
});

// What can't be seen isn't acted on: a file hidden or filtered away leaves the selection.
watch(ordered, shown => {
  if (selected.value.size > 0) {
    const paths = new Set(shown.map(file => file.path));
    const kept = [...selected.value].filter(path => paths.has(path));
    if (kept.length < selected.value.size) {
      selected.value = new Set(kept);
    }
  }
});

watch(fileListHidden, hidden => {
  if (hidden) {
    selected.value = new Set();
    leftScrolled.value = false;
    returnKeysToDiff();
  }
});

// A pull request not in the local copy: its stack is known only now. Its rows go in above the files on screen, which
// stay where they are, the bar showing in their place; the rows are one scroll up.
watch(stack, async (known, before) => {
  const fileListTop =
    allFiles.value.length > 0 ? leftColumn.value?.lastElementChild?.getBoundingClientRect().top : null;
  if (known && !before && fileListTop != null) {
    await nextTick();
    const moved = (leftColumn.value?.lastElementChild?.getBoundingClientRect().top ?? fileListTop) - fileListTop;
    leftColumn.value?.scrollBy(0, moved);
  }
});

// Closed from inside itself, its button or its text having the focus: the keys go back to the diff.
watch(conversationShown, shown => {
  if (!shown) {
    void nextTick(() => {
      if (document.activeElement === document.body) {
        list.value?.focus();
      }
    });
  }
});

watch(
  () => files.value?.list.kind,
  kind => {
    if (kind === 'ready') {
      performance.measure('review:list', { start: openedAt, end: performance.now() });
    }
  },
  { immediate: true },
);

watch(rows, next => {
  if (!firstRowMeasured && next.some(row => row.kind === 'line')) {
    firstRowMeasured = true;
    requestAnimationFrame(() => {
      performance.measure('review:first-row', { start: openedAt, end: performance.now() });
    });
  }
});

onWindowEvent('pointerup', () => {
  const drag = commentDrag.value;
  commentDrag.value = null;
  if (drag && drag.from !== drag.to) {
    startComment({
      path: drag.path,
      side: drag.side,
      startLine: Math.min(drag.from, drag.to),
      line: Math.max(drag.from, drag.to),
    });
  }
});

// Gone elsewhere in the app: a box coming back into the window doesn't take the keys from there.
onWindowEvent('focusin', event => {
  if (event.target instanceof Node && !diffColumn.value?.contains(event.target)) {
    focusedBox.value = null;
  }
});

// Refused while the keys are still around the diff: back in the box, where they can try another way.
watch(
  () => (sentBox.value === null ? null : (writing.value?.getStatus(sentBox.value).kind ?? null)),
  kind => {
    if (kind === 'failed' && diffColumn.value?.contains(document.activeElement)) {
      focusedBox.value = sentBox.value;
    }
  },
);

// Outside the local copy no poll reads its draft, and its row moves on with the detail alone: back from finishing the
// draft on GitHub, the toolbar must not stay. `ensure` would skip a read made under a minute ago.
onWindowEvent('focus', () => {
  if (opened.id === null) {
    return;
  }

  // A draft begun on GitHub shows on coming back, whatever polls this pull request: at most one read a minute.
  if (pendingReview.value && !items.getStored(opened.id)) {
    void details.readAgain(opened.id);
  } else {
    void details.ensure(opened.id);
  }
});

useCommands(() => [
  {
    id: 'review.nextPullRequest',
    title: t(l.nextPullRequest),
    section: 'view',
    key: 'J',
    icon: ChevronDown,
    when: () => nextPullRequest.value !== null,
    run: () => stepPullRequest(nextPullRequest.value, 'K'),
  },
  {
    id: 'review.previousPullRequest',
    title: t(l.previousPullRequest),
    section: 'view',
    key: 'K',
    icon: ChevronUp,
    when: () => previousPullRequest.value !== null,
    run: () => stepPullRequest(previousPullRequest.value, 'J'),
  },
  ...otherStackPullRequests.value.map((pullRequest): Command => ({
    id: `review.goTo.${pullRequest.id}`,
    title: t(l.goToPullRequest, { number: pullRequest.number, title: pullRequest.title }),
    section: 'view',
    icon: GitPullRequest,
    run: () => goToPullRequest(pullRequest),
  })),
  {
    id: 'review.previousFile',
    title: t(l.previousFile),
    section: 'view',
    key: '[',
    icon: ArrowUpToLine,
    when: () => ordered.value.length > 0,
    run: () => stepFile(-1),
  },
  {
    id: 'review.nextFile',
    title: t(l.nextFile),
    section: 'view',
    key: ']',
    icon: ArrowDownToLine,
    when: () => ordered.value.length > 0,
    run: () => stepFile(1),
  },
  {
    id: 'review.nextThread',
    title: t(l.nextThread),
    section: 'view',
    key: 'N',
    icon: MessageSquare,
    when: () => walkedThreads.value.length > 0,
    run: () => stepThread(1),
  },
  {
    id: 'review.previousThread',
    title: t(l.previousThread),
    section: 'view',
    key: 'Shift+N',
    icon: MessageSquare,
    when: () => walkedThreads.value.length > 0,
    run: () => stepThread(-1),
  },
  {
    id: 'review.comment',
    title: t(l.commentOnLine),
    section: 'view',
    key: 'C',
    icon: MessageSquarePlus,
    // Here it never means a new issue, which the menu still offers: with no line on screen it does nothing.
    when: () => ordered.value.length > 0,
    run: () => {
      const line = findCursorLine();
      if (line) {
        startComment({ path: line.path, side: line.side, line: line.line, startLine: null });
      }
    },
  },
  {
    id: 'review.submit',
    title: t(l.submitReview),
    section: 'view',
    key: 'Shift+S',
    icon: Send,
    when: () => pendingReview.value !== null && finish.value.kind !== 'sending',
    run: () => {
      submitOpen.value = true;
    },
  },
  {
    id: 'review.discard',
    title: t(l.discardReview),
    section: 'view',
    icon: Trash2,
    when: () => pendingReview.value !== null && finish.value.kind !== 'sending',
    run: () => {
      discardOpen.value = true;
    },
  },
  {
    id: 'review.toggleViewed',
    title: (selected.value.size > 0 ? isSelectionViewed() : currentFile.value?.viewed === 'VIEWED')
      ? t(l.markNotViewed)
      : t(l.markViewed),
    section: 'view',
    key: 'V',
    icon: Eye,
    when: () => currentFile.value !== null || selected.value.size > 0,
    run: () => {
      if (selected.value.size > 0) {
        markSelected();
      } else if (currentFile.value) {
        toggleViewed(currentFile.value.path);
      }
    },
  },
  {
    id: 'review.toggleSelected',
    title: t(l.toggleSelected),
    section: 'view',
    key: 'X',
    icon: ListChecks,
    when: () => canSelect(),
    run: () => {
      if (currentPath.value !== null) {
        toggleSelected(currentPath.value);
      }
    },
  },
  {
    id: 'review.selectNext',
    title: t(l.selectNext),
    section: 'view',
    key: '}',
    when: () => canSelect(),
    run: () => extendSelection(1),
  },
  {
    id: 'review.selectPrevious',
    title: t(l.selectPrevious),
    section: 'view',
    key: '{',
    when: () => canSelect(),
    run: () => extendSelection(-1),
  },
  {
    id: 'review.clearSelection',
    title: t(l.clearSelection),
    section: 'view',
    key: 'Escape',
    menu: false,
    when: () => selected.value.size > 0 && !isLayerOpen(),
    run: clearSelection,
  },
  {
    id: 'review.clearFilter',
    title: t(l.clearFilter),
    section: 'view',
    key: 'Escape',
    menu: false,
    when: () => filterPattern.value !== '' && !isLayerOpen(),
    run: () => {
      filterPattern.value = '';
    },
  },
  {
    id: 'review.focusFilter',
    title: t(l.focusFilter),
    section: 'view',
    key: '/',
    icon: ListFilter,
    run: () => void focusFilter(),
  },
  {
    id: 'review.toggleFileList',
    title: fileListHidden.value ? t(l.showFileList) : t(l.hideFileList),
    section: 'view',
    key: 'Mod+B',
    icon: PanelLeft,
    run: () => {
      fileListHidden.value = !fileListHidden.value;
    },
  },
  {
    id: 'review.toggleConversation',
    title: conversationShown.value ? t(l.hideConversation) : t(l.showConversation),
    section: 'view',
    key: 'Alt+Mod+B',
    icon: PanelRight,
    run: () => {
      conversationShown.value = !conversationShown.value;
    },
  },
  {
    id: 'review.toggleCollapsed',
    title: isCurrentCollapsed() ? t(l.expandFile) : t(l.collapseFile),
    section: 'view',
    key: 'Space',
    icon: isCurrentCollapsed() ? UnfoldVertical : FoldVertical,
    // Space on a focused button is that button's, wherever else the key goes.
    when: () => currentFile.value !== null && document.activeElement?.closest('button, a') == null,
    run: () => {
      if (currentFile.value) {
        toggleCollapsed(currentFile.value.path);
      }
    },
  },
]);

function stepPullRequest(id: string | null, backKey: 'J' | 'K') {
  const item = id === null ? undefined : details.getItem(id);
  if (item) {
    navigation.noteReviewWalk({
      to: formatItemReference(getItemReference(item)),
      from: props.reference.number,
      back: backKey,
    });
    goToPullRequest(item);
  }
}

/**
 * Back where it was left, the status bar names the first row showing under the pinned header: the position kept is the
 * row at the very top of the screen, hidden under that header (CR26).
 */
function getShownArrival(shown: ReviewArrival): ReviewArrival {
  const key = list.value?.firstVisibleKey;
  const row = shown.kind === 'left' ? rows.value.find(other => other.key === key) : null;
  return row ? { kind: 'left', place: getReviewPosition(row, 0).place } : shown;
}

/** The reader moved: where it opened is no longer the news. */
function stopLanding() {
  landing.value = false;
  arrival.value = null;
}

/** In this one's place, on the review's page: Back returns to where the review was entered (D2). */
function goToPullRequest(item: Item) {
  void router.replace(getReviewPath(getItemReference(item)));
}

function stepFile(delta: 1 | -1) {
  const index = ordered.value.findIndex(file => file.path === currentPath.value);
  const target = ordered.value[index + delta];
  if (target) {
    jumpToFile(target.path);
  }
}

/** From the focused thread while it is near; scrolled away from it, from what is being read. */
function stepThread(delta: 1 | -1) {
  const walked = walkedThreads.value;
  const at = walked.findIndex(
    row => row.placement.thread.id === focusedThread.value && list.value?.getRowOffset(row.key) != null,
  );
  const target =
    at === -1
      ? findThreadFromRow({ rows: rows.value, key: list.value?.anchor?.key ?? null, delta })
      : walked[at + delta];
  if (target) {
    jumpToThread(target);
  }
}

/** A quarter down the screen, the code above it in sight (CR15), and held there (D7). A resolved one opens, to be read. */
function jumpToThread(row: ReviewThreadRow) {
  const { id, isResolved } = row.placement.thread;
  if (isResolved) {
    files.value?.setThreadOpen(id, true);
  }

  stopLanding();
  focusedThread.value = id;
  const height = diffColumn.value?.clientHeight ?? 0;
  list.value?.jumpTo(row.key, Math.round(Math.max(height / 4, THREAD_MIN_OFFSET)));
  list.value?.focus();
}

/** A click on a file's open threads in the list. */
function jumpToFileThreads(path: string) {
  const inFile = walkedThreads.value.find(row => getReviewRowPath(row.key) === path);
  if (inFile) {
    jumpToThread(inFile);
  } else {
    selectFile(path);
  }
}

/**
 * A review's "2 threads in files": the first of them in the diff's order, landing as N does, one that is resolved opened
 * for it was asked for. A filter or hidden viewed files holding it back give way; in a file collapsed with its comments
 * hidden, its header is as near as it gets.
 */
async function jumpToReviewThreads(reviewId: string) {
  const own = reviewThreads.value.get(reviewId);
  if (!own) {
    return;
  }

  if (!findFirstThreadRow(own.ids) && own.paths.some(isHeldBack)) {
    filterPattern.value = '';
    hideViewed.value = false;
    await nextTick();
  }

  const row = findFirstThreadRow(own.ids);
  if (row) {
    jumpToThread(row);
  } else if (own.paths[0] !== undefined) {
    selectFile(own.paths[0]);
  }
}

/** Whether the filter or hidden viewed files are what keeps the file out of the diff. */
function isHeldBack(path: string) {
  const known = [...allFiles.value, ...goneFiles.value].some(file => file.path === path);
  return known && !ordered.value.some(file => file.path === path);
}

function findFirstThreadRow(ids: ReadonlySet<string>) {
  return rows.value.find((row): row is ReviewThreadRow => row.kind === 'thread' && ids.has(row.placement.thread.id));
}

function isThreadOpen(id: string) {
  return files.value?.isThreadOpen(id) ?? false;
}

function toggleThread(id: string) {
  files.value?.setThreadOpen(id, !isThreadOpen(id));
}

/** "Expand to here": the context up to a thread, the thread staying where it is on screen. */
function expandToThread(mark: ReviewDistanceRow) {
  const path = getReviewRowPath(mark.key);
  const key = getReviewThreadKey(path, mark.placement.thread.id);
  const offset = list.value?.getRowOffset(key) ?? null;
  heldInExpanding = offset === null ? null : { key, offset };
  files.value?.expandLines(path, getDistanceLinesToShow(mark));
  returnKeysToDiff();
}

function expandToFileEnd(mark: ReviewFileEndRow) {
  files.value?.expandLines(getReviewRowPath(mark.key), mark.lines);
  returnKeysToDiff();
}

function canSelect() {
  return currentFile.value !== null && !fileListHidden.value;
}

function isSelectionViewed() {
  return allFiles.value.every(file => !selected.value.has(file.path) || file.viewed === 'VIEWED');
}

function toggleSelected(path: string) {
  if (!allFiles.value.some(file => file.path === path)) {
    return;
  }

  const next = new Set(selected.value);
  if (!next.delete(path)) {
    next.add(path);
  }

  selected.value = next;
  selectionStart = path;
}

/** ⇧click: from where the selection started up to the file, in place of what was selected. */
function selectRange(path: string) {
  const paths = ordered.value.filter(file => !file.gone).map(file => file.path);
  const start = paths.indexOf(selectionStart ?? currentPath.value ?? path);
  const end = paths.indexOf(path);
  // A gone file's row: it can't be selected.
  if (end === -1) {
    return;
  }

  selected.value = new Set(start === -1 ? [path] : paths.slice(Math.min(start, end), Math.max(start, end) + 1));
  selectionStart = paths[start] ?? path;
}

/** Adds the file in view and the one `delta` away, and goes there, as a list's ⇧J and ⇧K do. */
function extendSelection(delta: 1 | -1) {
  const from = currentPath.value;
  stepFile(delta);
  const known = new Set(allFiles.value.map(file => file.path));
  selected.value = new Set(
    [...selected.value, from, currentPath.value].filter(path => path !== null).filter(path => known.has(path)),
  );
  selectionStart = from;
}

function clearSelection() {
  selected.value = new Set();
  selectionStart = null;
}

/** All of them viewed, or all not viewed again; the selection stays, for what went wrong to be put back. */
function markSelected() {
  files.value?.setViewed([...selected.value], !isSelectionViewed());
  returnKeysToDiff();
}

async function focusFilter() {
  fileListHidden.value = false;
  await nextTick();
  fileList.value?.focusFilter();
}

/** Shows lines of a gap, the row under it staying where it is on screen: it's what is being read. */
function expandGap(gap: ReviewGapRow, count: number) {
  const below = gap.atFileEnd ? null : rows.value[rows.value.indexOf(gap) + 1];
  // A thread's distance mark goes with the gap: it's the thread that stays.
  const key =
    below?.kind === 'distance'
      ? getReviewThreadKey(getReviewRowPath(below.key), below.placement.thread.id)
      : below?.key;
  const offset = key === undefined ? null : (list.value?.getRowOffset(key) ?? null);
  heldInExpanding = key !== undefined && offset !== null ? { key, offset } : null;
  files.value?.expandLines(getReviewRowPath(gap.key), getGapLinesToShow(gap, count));
  returnKeysToDiff();
}

function jumpToFile(path: string) {
  stopLanding();
  focusedThread.value = null;
  files.value?.prioritize(path);
  list.value?.jumpTo(getReviewHeaderKey(path), 0);
}

/** A plain click: on its own, or `V` would go on marking the files selected before. */
function selectFile(path: string) {
  selected.value = new Set();
  selectionStart = path;
  jumpToFile(path);
  list.value?.focus();
}

function getState(path: string) {
  return files.value?.getState(path) ?? WAITING;
}

function getCollapse(path: string) {
  return files.value?.getCollapse(path) ?? null;
}

function isCurrentCollapsed() {
  return currentFile.value !== null && getCollapse(currentFile.value.path) !== null;
}

function toggleCollapsed(path: string) {
  files.value?.setCollapsed(path, getCollapse(path) === null);
  returnKeysToDiff();
}

function toggleViewed(path: string) {
  const file = allFiles.value.find(other => other.path === path);
  const viewed = file?.viewed !== 'VIEWED';
  files.value?.setViewed([path], viewed);
  // Opened again in front of the reader: what's in view is fetched next (D35), not after every other file.
  if (!viewed && path === currentPath.value) {
    files.value?.prioritize(path);
  }

  returnKeysToDiff();
}

/** After the header's button, which may be gone by now: the keys go on acting on the diff. */
function returnKeysToDiff() {
  void nextTick(() => list.value?.focus());
}

/** "Show only these": through the filter, which says what is on and which Esc clears. */
function showOnlyLostViewed() {
  const paths = lostViewedPaths.value;
  files.value?.setFilter({ pattern: paths.join(', '), regex: false, paths });
  fileListHidden.value = false;
}

function canEdit(id: string) {
  const kind = writing.value?.getStatus(id).kind;
  return kind === 'editing' || kind === 'failed';
}

/** The line of the focused thread while it is on screen, or else the first line on screen (D32). */
function findCursorLine(): ReviewCommentLine | null {
  const height = diffColumn.value?.clientHeight ?? 0;
  const isOnScreen = (key: string) => {
    const offset = list.value?.getRowOffset(key) ?? null;
    return offset !== null && offset < height && offset >= 0;
  };
  const row = walkedThreads.value.find(({ placement }) => placement.thread.id === focusedThread.value);
  if (row && isOnScreen(row.key)) {
    const { placement } = row;
    if (placement.kind === 'onLine' || placement.kind === 'hiddenLine') {
      return { path: getReviewRowPath(row.key), side: placement.side, line: placement.line, key: row.key };
    }
  }

  const line = findCommentLine(rows.value, list.value?.firstVisibleKey ?? null);
  return line && isOnScreen(line.key) ? line : null;
}

function startComment(target: Omit<ReviewCommentTarget, 'id'>) {
  const box = writing.value?.open(target);
  if (box) {
    stopLanding();
    focusedBox.value = box.id;
    void revealComment(box);
  }
}

/** Only when it wouldn't fit on screen, and then by as little as it takes (D7). */
async function revealComment({ path, id }: ReviewCommentTarget) {
  await nextTick();
  const key = getReviewCommentKey(path, id);
  const height = diffColumn.value?.clientHeight ?? 0;
  const offset = list.value?.getRowOffset(key) ?? height;
  if (offset + COMMENT_BOX_HEIGHT > height) {
    list.value?.jumpTo(key, Math.max(height - COMMENT_BOX_HEIGHT, THREAD_MIN_OFFSET));
  }
}

/** ⇧click: the box being written on this side of the file now reaches the line, up to what hides lines from it (CR73). */
function extendComment(path: string, side: DiffLineSide, line: number) {
  const box = commentTargets.value.findLast(
    target => target.path === path && target.side === side && (target.id === focusedBox.value || canEdit(target.id)),
  );
  if (!box) {
    startComment({ path, side, line, startLine: null });
    return;
  }

  const from = box.startLine ?? box.line;
  const to = clampCommentRange({ rows: rows.value, path, side, line: from, to: line });
  writing.value?.setRange(box.id, from === to ? null : Math.min(from, to), Math.max(from, to));
  focusedBox.value = box.id;
}

function onGutter(row: ReviewRow, event: MouseEvent, side: DiffLineSide, line: number) {
  const path = getReviewRowPath(row.key);
  const drag = commentDrag.value;
  switch (event.type) {
    case 'pointerdown':
      commentDrag.value = event.button === 0 && !event.shiftKey ? { path, side, from: line, to: line } : null;
      break;
    case 'pointerenter':
      if (drag?.path === path && drag.side === side) {
        const to = clampCommentRange({ rows: rows.value, path, side, line: drag.from, to: line });
        commentDrag.value = { ...drag, to };
      }

      break;
    case 'click':
      if (event.shiftKey) {
        extendComment(path, side, line);
      } else {
        startComment({ path, side, line, startLine: null });
      }

      break;
    default:
      break;
  }
}

function onRowFocusLost(key: string) {
  const box = commentTargets.value.find(target => getReviewCommentKey(target.path, target.id) === key);
  if (box) {
    focusedBox.value = box.id;
  }
}

function sendComment(id: string, way: ReviewCommentWay) {
  sentBox.value = id;
  focusedBox.value = null;
  writing.value?.send(id, way);
  returnKeysToDiff();
}

/** Escape: with text in it the box stays, with its text; empty it goes. Either way the keys are the diff's again. */
function leaveComment(id: string) {
  focusedBox.value = null;
  if (writing.value?.getText(id).trim() === '') {
    writing.value.close(id);
  }

  list.value?.focus();
}

function onCommentBlur(id: string) {
  if (focusedBox.value === id) {
    focusedBox.value = null;
  }
}

function submitReview() {
  submitOpen.value = false;
  writing.value?.submit(submission.value);
  returnKeysToDiff();
}

function discardReview() {
  discardOpen.value = false;
  writing.value?.discard();
  returnKeysToDiff();
}

function isPinned(row: ReviewRow) {
  return row.kind === 'header';
}

function back() {
  goBack(router, getItemPagePath(props.reference, 'pullRequest'));
}

function readAgain() {
  files.value = reviewFiles.open(props.reference);
}
</script>

<template>
  <div :class="css.reviewView">
    <ReviewToolbar
      v-model:layout="layout"
      v-model:hide-whitespace="hideWhitespace"
      v-model:file-list-hidden="fileListHidden"
      v-model:conversation-shown="conversationShown"
      v-model:threads-in-collapsed="threadsInCollapsed"
      :reference="reference"
      :item="opened.item"
      :github-url="githubUrl"
      :position="walkPosition"
      @back="back"
      @previous="stepPullRequest(previousPullRequest, 'J')"
      @next="stepPullRequest(nextPullRequest, 'K')"
    />
    <ReviewLostViewedBar
      v-if="lostViewedPaths.length > 0"
      :paths="lostViewedPaths"
      @show-only="showOnlyLostViewed"
      @dismiss="files?.dismissLostViewedNotice()"
    />
    <div :class="css.reviewView_body">
      <div
        v-if="!fileListHidden"
        ref="leftColumn"
        :class="[css.reviewView_left, stack && opened.id !== null && css.reviewView_left_stacked]"
        @scroll.passive="leftScrolled = (leftColumn?.scrollTop ?? 0) > 0"
      >
        <template v-if="stack && opened.id !== null">
          <ReviewStackStrip
            :class="!leftScrolled && css.reviewView_strip_hidden"
            :stack="stack"
            :current-id="opened.id"
          />
          <ReviewStack
            :stack="stack"
            :current-id="opened.id"
          />
        </template>
        <ReviewFileList
          ref="fileList"
          v-model:hide-viewed="hideViewed"
          v-model:filter-pattern="filterPattern"
          v-model:filter-regex="filterRegex"
          :groups="listGroups"
          :files="allFiles"
          :get-state="getState"
          :get-collapse="getCollapse"
          :get-collapse-reason="path => files?.getCollapseReason(path) ?? null"
          :current-path="currentPath"
          :changed-files="files?.changedFiles ?? null"
          :list-complete="files?.listComplete ?? false"
          :matched="filterOn ? matchedFiles.length : null"
          :filter-invalid="typedFilter.kind === 'invalid'"
          :selected="selected"
          :lost-viewed="lostViewed"
          :open-threads="openThreads"
          :resolved-threads="resolvedThreads"
          @select="selectFile"
          @select-threads="jumpToFileThreads"
          @select-range="selectRange"
          @toggle-selected="toggleSelected"
          @mark-selected="markSelected"
          @clear-selection="clearSelection"
          @leave-filter="list?.focus()"
        />
      </div>
      <div :class="css.reviewView_diffColumn">
        <div
          ref="diffColumn"
          :class="css.reviewView_diff"
        >
          <AnchoredList
            v-if="files?.list.kind === 'ready' && (ordered.length > 0 || filterOn)"
            ref="list"
            :rows="rows"
            :estimate-height="estimateReviewRowHeight"
            :is-pinned="isPinned"
            :label="t(l.diff)"
            @user-scroll="stopLanding"
            @row-focus-lost="onRowFocusLost"
          >
            <template #default="{ row }">
              <ReviewDiffRow
                :row="row"
                :github-url="githubUrl"
                :changed-since="row.kind === 'header' && lostViewed.has(row.file.path)"
                :thread-open="row.kind === 'thread' && isThreadOpen(row.placement.thread.id)"
                :thread-focused="row.kind === 'thread' && focusedThread === row.placement.thread.id"
                :commented="row.kind === 'line' ? commentedLines.get(getReviewRowPath(row.key)) : undefined"
                @expand="expandGap"
                @expand-to-thread="expandToThread"
                @expand-to-file-end="expandToFileEnd"
                @show-whitespace="hideWhitespace = false"
                @toggle-thread="toggleThread"
                @retry="path => files?.retry(path)"
                @toggle-collapsed="toggleCollapsed"
                @toggle-viewed="toggleViewed"
                @gutter="(event, side, line) => onGutter(row, event, side, line)"
              >
                <template #comment="{ row: commentRow }">
                  <ReviewCommentRow
                    :row="commentRow"
                    :text="writing?.getText(commentRow.target.id)"
                    :status="writing?.getStatus(commentRow.target.id) ?? { kind: 'editing' }"
                    :draft-open="writing?.draftOpen ?? false"
                    :draft-count="writing?.draftCount ?? 0"
                    :draft-first="COMMENT_DRAFT_FIRST"
                    :focused="focusedBox === commentRow.target.id"
                    :author="auth.viewer ?? null"
                    @update:text="writing?.setText(commentRow.target.id, $event)"
                    @send="way => sendComment(commentRow.target.id, way)"
                    @leave="leaveComment(commentRow.target.id)"
                    @focus="focusedBox = commentRow.target.id"
                    @blur="onCommentBlur(commentRow.target.id)"
                  />
                </template>
              </ReviewDiffRow>
            </template>
          </AnchoredList>
          <!-- Over the list, not instead of it: a pattern passing through no match keeps the place being read (D7). -->
          <div
            v-if="ordered.length === 0 || files?.list.kind !== 'ready'"
            :class="css.reviewView_state"
          >
            <EmptyState
              v-if="files?.list.kind === 'failed' || files?.list.kind === 'gone'"
              :icon="CircleAlert"
              :title="files.list.kind === 'gone' ? t(l.gone) : t(l.listFailed)"
              :detail="files.list.kind === 'gone' ? t(l.goneDetail) : getFailureText(files.list.error)"
            >
              <template #action>
                <div :class="css.reviewView_actions">
                  <Button
                    size="sm"
                    @click="readAgain"
                  >
                    {{ t(l.tryAgain) }}
                  </Button>
                  <Button
                    size="sm"
                    :link="githubUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ t(l.openOnGitHub) }}
                  </Button>
                </div>
              </template>
            </EmptyState>
            <EmptyState
              v-else-if="files?.list.kind === 'paused'"
              :icon="Pause"
              :title="t(l.paused)"
              :detail="t(l.pausedDetail, { time: formatTime(files.list.until) })"
            >
              <template #action>
                <Button
                  size="sm"
                  :link="githubUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ t(l.openOnGitHub) }}
                </Button>
              </template>
            </EmptyState>
            <EmptyState
              v-else-if="files?.list.kind === 'ready' && filterOn"
              :icon="FileSearch"
              :title="t(l.noMatch)"
              :detail="hideViewed && matchedFiles.length > 0 ? t(l.noMatchViewedHidden) : undefined"
            >
              <template #action>
                <Button
                  size="sm"
                  @click="filterPattern = ''"
                >
                  {{ t(l.clearFilter) }}
                </Button>
              </template>
            </EmptyState>
            <EmptyState
              v-else-if="files?.list.kind === 'ready' && allFiles.length > 0"
              :icon="CircleCheck"
              :title="t(l.allViewed, { total: numbers.format(allFiles.length) })"
              :detail="t(l.allViewedDetail)"
            >
              <template #action>
                <Button
                  size="sm"
                  @click="hideViewed = false"
                >
                  {{ t(l.showViewed) }}
                </Button>
              </template>
            </EmptyState>
            <EmptyState
              v-else-if="files?.list.kind === 'ready'"
              :icon="Equal"
              :title="t(l.noChanges)"
              :detail="
                branches
                  ? t(l.noChangesDetail, { head: branches.headRefName, base: branches.baseRefName })
                  : t(l.noChangesPlain)
              "
            >
              <template #action>
                <div :class="css.reviewView_actions">
                  <Button
                    v-if="!conversationShown"
                    size="sm"
                    @click="conversationShown = true"
                  >
                    {{ t(l.conversation) }}
                    <Kbd keys="Alt+Mod+B" />
                  </Button>
                  <Button
                    size="sm"
                    :link="githubUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ t(l.openOnGitHub) }}
                  </Button>
                </div>
              </template>
            </EmptyState>
            <EmptyState
              v-else
              :icon="FileSearch"
              :title="t(l.reading, { reference: formatItemReference(reference) })"
            />
          </div>
        </div>
        <ReviewPendingToolbar
          v-if="pendingReview"
          :comment-count="pendingReview.commentCount"
          :finish="finish"
          @discard="discardOpen = true"
          @submit="submitOpen = true"
          @retry="writing?.retry()"
        />
      </div>
      <div
        v-if="conversationShown"
        :class="css.reviewView_conversation"
      >
        <ReviewConversation
          :item="opened.item"
          :detail="detail"
          :review-threads="reviewThreads"
          :load-older="opened.loadAllComments"
          :load-older-reviews="opened.loadAllReviews"
          @close="conversationShown = false"
          @jump-to-threads="jumpToReviewThreads"
        />
      </div>
    </div>
    <ReviewSubmitDialog
      v-model:open="submitOpen"
      v-model:choice="submission"
      :number="reference.number"
      :comment-count="pendingReview?.commentCount ?? 0"
      :comments="pendingComments"
      @submit="submitReview"
    />
    <ReviewDiscardDialog
      v-model:open="discardOpen"
      :number="reference.number"
      :comment-count="pendingReview?.commentCount ?? 0"
      :comments="pendingComments"
      @discard="discardReview"
    />
  </div>
</template>

<style lang="scss" module="css">
.reviewView {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  background: $color-bg;
}

.reviewView_body {
  display: flex;
  flex: 1;
  min-height: 0;
}

// One scroller for the stack and the files: nothing here takes height from the diff, and what stops moves nothing (D25).
// No browser's own anchoring: where the files stay when a stack arrives is `ReviewView`'s, in the desktop app's too.
.reviewView_left {
  display: flex;
  flex: none;
  flex-direction: column;
  width: $review-file-list-width;
  min-height: 0;
  overflow-y: auto;
  overflow-anchor: none;
  border-right: 1px solid $color-border;
}

.reviewView_left_stacked {
  --review-file-list-top: #{$review-stack-strip-height};
}

.reviewView_strip_hidden {
  visibility: hidden;
}

.reviewView_diffColumn {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.reviewView_diff {
  position: relative;
  flex: 1;
  min-height: 0;
}

.reviewView_conversation {
  flex: none;
  width: $review-conversation-width;
  min-height: 0;
  border-left: 1px solid $color-border;
}

.reviewView_state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-bg;
}

.reviewView_actions {
  display: flex;
  gap: $spacing-8;
}
</style>
