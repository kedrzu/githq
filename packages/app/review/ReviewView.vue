<!-- A pull request's review (D24): the toolbar, the list of files on the left — its width dragged by its edge and kept on this device (`ColumnSplit`), the diff staying mounted as it hides — and the diff filling the rest, every file one after another under its pinned header. Files arrive and diffs are computed while it shows, none of it moving what is being read (D7): a jump (a click in the list, `[` `]`) lands its file's header exactly at the top and holds it there through files arriving above, the layout and the whitespace setting; a line being read stays on screen through them too. A file that fails, is too large or binary says so in place and the others go on (D35); a submodule shows the commits, files and pull requests between its two pointers, read only once its block is drawn. Lock files, generated and very large files start as a header, nothing of them fetched until opened; Space or a click on the header opens the file or collapses it (D8). `V` or the header's button sets the file's viewed mark, GitHub's own (D9), which collapses the file to its header in place, or with viewed files hidden the next file takes its place, and with all of them viewed the diff says so. The diff has a line cursor the pointer and the keys share (D44): moving the pointer over a file's header, a row of code, a thread or a gap puts it there, moving nothing, though not rows scrolling under a still pointer, a drag along the numbers or the pinned header's overlay, a press on which puts it on that file's header; ↓ ↑ move it a stop, faster the longer they are held, and PageDown PageUp a screen, the diff scrolling only to keep it a third of the screen from the edge it goes toward; a scroll taking it off the screen brings it to the first stop at the edge it left by. Its file is the current file, the one `V`, Space and `C` act on. `[` `]`, the list and `V` moving on put it on a file's header, N ⇧N and a link on their thread, and rows changing under it leave it on its stop, or the nearest left, its file's header first. Files selected in the list (x, { }, ⇧click, ⌘click, D10) take `V` together, in one request. `/` filters (D11): files filtered away leave the diff too, the reader moving on to the next one left. A gap's arrows show 20 lines below the hunk above it or above the hunk below, holding the row on that side where it is (D6, D7, D42); a click on the rest of the row goes toward the hunk on the side of a line a third down the screen, and so does E, for the gap under the cursor or else its file's nearest, and "Show all hidden lines" in the command menu opens all of that gap. Every thread shows where it belongs (D12, D13, D30), a file with an unresolved one is never hidden as viewed (D15), one gone from the diff has an entry of its own, and N ⇧N walk them, the open ones first, each landing held in place and opened (D7, D32). A pull request of a stack has the stack above the files, in a left column that scrolls as one: the rows go by and a bar stays pinned, the files' head under it (D25). `J` `K` walk the list it was opened from as in an opened pull request (D16), `[` `]` being the files; a row or a square of the stack and the command menu go to any of its pull requests, always replacing the address, so Back returns to where the review was entered (D2). The view options are commands of the command menu too, each flipping what its control does and its title saying what picking it does: the layout, whitespace changes, comments in collapsed files and, once the files are known, viewed files. ⌘B hides the left column and ⌥⌘B shows the pull request's conversation at the right (D5, D26), its width dragged by its edge from 340 px and kept on this device (D46), and a review's "2 threads in files" there lands on the first of them as N does. The diff stands in a box centred between them, the gaps beside it scrolling the diff: its left or right edge dragged (or moved by the arrow keys) symmetrically, from 800 px to the width there is, a maximum kept in the user's synced settings, by default the whole width; the side columns or the window drawing it narrower never change it, and the pinned header, the review's toasts and the pending toolbar's content keep to it. GitHub's allowance running out pauses the missing files, which carry on by themselves at its reset, and the status bar says so; files GitHub took the viewed mark off since the last visit are named in a line that goes once the first of them has been read (D35). What the user did here is kept for this pull request, and it opens where they left it, by the line, or the first time on its first file not viewed nor collapsed (D7, D14, D16), the cursor on the first stop under the pinned header, the status bar saying so until the first move (CR20, CR25, CR26). An address naming a comment on the code (`#discussion_r…`, GitHub's `#r…`), as a file's link on the pull request's page gives, lands instead on its thread as N does, its file let past the filter and hidden viewed files and opened if collapsed; the fragment then leaves the address. Every file viewed and those hidden, what is left of them shows under a block saying so, with the ways on (CR63). While the viewer has a draft review on it, a toolbar at the foot of the diff says how many comments wait and leads to submitting or discarding it (D28, D33); ⇧S opens the same dialog with no draft, for a review with no comments. O to the pull request on GitHub and Esc, once there's no box, selection or filter to leave, back to the pull request; `?` shows all a review's keys (CR29). A line's number or `C` opens a comment box under it (D32), a drag from a number or the comment button along the lines, or a ⇧click on the numbers, making it a range (CR73): `C` takes the cursor's line, on the newer side unless the row has only the older, or a thread's own line, and does nothing on a header, a gap or a thread on the file (D44); a box closed, discarded or sent gives the keys back to the diff, the cursor on its line. Nothing moves for it unless the box wouldn't fit on screen, by as little as it takes (D7). A box scrolled out of the list's window takes the keys back when it comes back into it. Esc closes an empty box and asks before discarding one with text; a discarded one is offered back by a toast of the review's own at the foot of the diff, above the pending toolbar, Restore (⌘Z outside a text field) reopening it with its text (D40). `⇧↓` `⇧↑` from the diff choose lines from the cursor's line, the cursor on the end they move, Esc letting them go and `C` commenting on them, a box left on one of them taking them all; in an empty box they make it end a line further or sooner. While the keys are in a text field the cursor's row is not tinted, its comment buttons still there for the pointer (D44). `R`, on the thread under the cursor, or Reply… opens a reply box inside the thread, in a band after its comments, Resolve thread under it (CR74, D39), moving nothing unless the box wouldn't fit on screen, `⌘G` a suggestion where GitHub would take one (D18). Resolve folds the thread where it is, what is above it staying put and a viewed or gone file staying until it leaves the top of the screen (D7), and N and ⇧N go on through the open ones from there (CR15). The conversation's foot comments on the pull request itself, at once whatever draft is open (D17). The pull request reviewed is the command menu's subject, its actions there and on their keys as in an opened one — Merge… (`⇧M`), its branch, its checks, assignees, labels, closing — but while an item is opened over the review, whose own they then are. -->
<script lang="ts">
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

const numbers = new Intl.NumberFormat(APP_LANGUAGE);
</script>

<script lang="ts" setup>
import type { SubmodulePointers } from '@githq/github/utils/parseSubmodulePatch.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  ArrowUpToLine,
  ChevronsDown,
  ChevronsUp,
  CircleAlert,
  CircleCheck,
  Equal,
  Eye,
  EyeOff,
  FileSearch,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Columns2,
  FoldVertical,
  GitPullRequest,
  Github,
  ListChecks,
  ListFilter,
  MessageSquare,
  MessageSquarePlus,
  Reply,
  Send,
  PanelLeft,
  PanelRight,
  Pause,
  Rows2,
  Trash2,
  UnfoldVertical,
} from 'lucide-vue-next';
import { computed, nextTick, onScopeDispose, shallowRef, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AccountSession } from '@/auth/AccountSession.js';
import { AuthStore } from '@/auth/AuthStore.js';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import type { Command } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import ColumnSplit from '@/components/ColumnSplit.vue';
import EmptyState from '@/components/EmptyState.vue';
import Kbd from '@/components/Kbd.vue';
import Toaster from '@/components/Toaster.vue';
import { useMaxWidth } from '@/components/useMaxWidth.js';
import WidthHandle from '@/components/WidthHandle.vue';
import { CommentDrafts } from '@/edits/CommentDrafts.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import {
  formatItemReference,
  formatShortReference,
  getItemPagePath,
  getItemReference,
  getOpenedItemRoute,
  getReviewPath,
} from '@/item/itemRoutes.js';
import type { ItemReference } from '@/item/itemRoutes.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { useItemStack } from '@/item/useItemStack.js';
import { getStackMembers } from '@/store/stacks/getStackMembers.js';
import { useItemWalk } from '@/item/useItemWalk.js';
import { useOpenedItem } from '@/item/useOpenedItem.js';
import { useItemCommands } from '@/lists/useItemCommands.js';
import { MergeContext } from '@/merge/MergeContext.js';
import { Browser } from '@/services/Browser.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import type { Freshness } from '@/sync/Freshness.js';
import { ReloadHolds } from '@/sync/ReloadHolds.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { formatList } from '@/utils/formatList.js';
import { formatTime } from '@/utils/formatTime.js';
import { goBack } from '@/utils/goBack.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';

import AnchoredList from './AnchoredList.vue';
import type { AnchoredListExposed } from './AnchoredList.vue';
import {
  clampCommentRange,
  COMMENT_BOX_HEIGHT,
  estimateReviewRowHeight,
  FILE_GAP,
  findReplacementRow,
  GAP_STEP,
  getCommentLine,
  getDistanceLinesToShow,
  getGapLinesToShow,
  getGapSize,
  getGapStep,
  getReviewAllViewedKey,
  getReviewCommentKey,
  getReviewHeaderKey,
  getReviewPlacePath,
  getReviewPosition,
  getReviewRowPath,
  getReviewThreadKey,
  getRowLineOn,
  isFileWaiting,
} from './buildReviewRows.js';
import type {
  ReviewCommentLine,
  ReviewDistanceRow,
  ReviewFileEndRow,
  ReviewGapDirection,
  ReviewGapRow,
  ReviewGapStep,
  ReviewRow,
  ReviewThreadRow,
} from './buildReviewRows.js';
import type { DiffLineSide } from './diff/buildDiffRows.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import { getReviewOwnThreads } from './conversation/getReviewOwnThreads.js';
import ReviewConversation from './conversation/ReviewConversation.vue';
import { findCursorOnScreen } from './cursor/findCursorOnScreen.js';
import type { ReviewCursor } from './cursor/ReviewCursor.js';
import { groupReviewFiles } from './groupReviewFiles.js';
import type { ReviewFileGroup } from './groupReviewFiles.js';
import * as allViewedLoc from './ReviewAllViewed.loc.js';
import ReviewAllViewed from './ReviewAllViewed.vue';
import ReviewDiffRow from './ReviewDiffRow.vue';
import ReviewFileList from './ReviewFileList.vue';
import ReviewLostViewedBar from './ReviewLostViewedBar.vue';
import ReviewPendingToolbar from './ReviewPendingToolbar.vue';
import { ReviewFiles } from './ReviewFiles.js';
import { ReviewScreenFreshness } from './ReviewScreenFreshness.js';
import ReviewStack from './ReviewStack.vue';
import ReviewStackStrip from './ReviewStackStrip.vue';
import type { PullRequestFiles, ReviewFile, ReviewFileState } from './ReviewFiles.js';
import { ReviewSubmodules } from './submodules/ReviewSubmodules.js';
import type { ReviewSubmoduleChange } from './submodules/ReviewSubmodules.js';
import { countThreads } from './threads/countThreads.js';
import type { ReviewThreadReplies } from './threads/ReviewThreadBox.vue';
import { findLinkedThread, parseThreadAnchor } from './threads/findLinkedThread.js';
import { findOpenThreadFrom, findThreadFromRow, listWalkedThreads } from './threads/walkThreads.js';
import ReviewToolbar from './ReviewToolbar.vue';
import * as l from './ReviewView.loc.js';
import { REVIEW_KEYS, useReviewKeySheet } from './useReviewKeySheet.js';
import { useReviewCursor } from './useReviewCursor.js';
import { useReviewPosition } from './useReviewPosition.js';
import type { ReviewArrival } from './useReviewPosition.js';
import { useReviewRows } from './useReviewRows.js';
import type { ReviewThreadPlacements } from './useReviewRows.js';
import { createFileFilter } from './utils/createFileFilter.js';
import type { FileFilter, FileFilterInput } from './utils/createFileFilter.js';
import { getFailureText } from './utils/getFailureText.js';
import { getLandingFreshness } from './utils/getLandingFreshness.js';
import { getReadingLine } from './utils/getReadingLine.js';
import { getReviewFreshness } from './utils/getReviewFreshness.js';
import { getReviewPlaceFreshness } from './utils/getReviewPlaceFreshness.js';
import type { CommentedLines } from './utils/isLineCommented.js';
import { getPendingComments } from './writing/getPendingComments.js';
import { getReplyTarget } from './writing/getReplyTarget.js';
import { formatSuggestion, getSuggestionLines } from './writing/getSuggestionLines.js';
import ReviewDiscardDialog from './writing/ReviewDiscardDialog.vue';
import ReviewDiscardedToast from './writing/ReviewDiscardedToast.vue';
import ReviewSubmitDialog from './writing/ReviewSubmitDialog.vue';
import { NO_REVIEW_SUBMISSION, REVIEW_FINISH_IDLE } from './writing/ReviewWriting.js';
import type { ReviewCommentTarget, ReviewCommentWay } from './writing/ReviewWriting.js';
import ReviewWrittenComment from './writing/ReviewWrittenComment.vue';

const props = defineProps<{
  reference: ItemReference;
}>();

const WAITING: ReviewFileState = { kind: 'waiting' };
const NO_FILTER: FileFilterInput = { pattern: '', regex: false };
const NO_FILES: ReadonlySet<string> = new Set();
/** A jump to a thread never lands higher than this under the top: the pinned header and a little air. */
const THREAD_MIN_OFFSET = 46;
const NO_TARGETS: readonly ReviewCommentTarget[] = [];
/** The stack's and the files' column: 300 px by default, dragged from 200 to 480 px (D24). */
const FILE_LIST_WIDTH = { key: 'reviewFileList', default: 300, min: 200, max: 480 };
/** The conversation's column at the right (CR121): 340 px by default and at least, dragged out to 720 px. */
const CONVERSATION_WIDTH = { key: 'reviewConversation', default: 340, min: 340, max: 720 };
/** The narrowest the diff's box is drawn, whatever maximum is kept. */
const DIFF_MIN_WIDTH = 800;

/** Lines being chosen for a comment, on one side of a file: from the line it started on to the one it reaches now. */
interface LineRange {
  readonly path: string;
  readonly side: DiffLineSide;
  readonly from: number;
  readonly to: number;
  /** By the pointer, still pressed; else by the keys. */
  readonly dragging: boolean;
}

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
const editor = useService(ItemEditor);
const commentDrafts = useService(CommentDrafts);
const registry = useService(CommandRegistry);
const browser = useService(Browser);
const tracking = useService(TrackingStore);
const submodules = useService(ReviewSubmodules);
const router = useRouter();
const route = useRoute();
/** Merging, where the screen offers it (the shell's). */
const merging = injectContext(MergeContext, { optional: true });

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
const list = useTemplateRef<AnchoredListExposed<ReviewRow>>('list');
const fileList = useTemplateRef<InstanceType<typeof ReviewFileList>>('fileList');
const diffColumn = useTemplateRef<HTMLElement>('diffColumn');
const leftColumn = useTemplateRef<HTMLElement>('leftColumn');
/** The width there is for the diff's box: the list's inside its scrollbar, 0 while there is no list. */
const diffRoom = computed(() => list.value?.width ?? 0);
const diffWidth = useMaxWidth({
  saved: () => tracking.reviewDiffWidth,
  save: width => tracking.setMaxWidth('reviewDiffWidth', width),
  default: 'full',
  min: DIFF_MIN_WIDTH,
  room: diffRoom,
});
/** How far in from each side of the list the diff's box stands: the room it leaves, split evenly. */
const diffInset = computed(() => Math.max((diffRoom.value - diffWidth.shown) / 2, 0));
/** Where the box is drawn over the list, for its edges and the review's toasts; never wider than the list. */
const diffBoxStyle = computed(() =>
  diffRoom.value > 0 ? { left: `${diffInset.value}px`, width: `${diffRoom.value - 2 * diffInset.value}px` } : undefined,
);
const layout = preferences.reviewLayout;
const hideWhitespace = preferences.reviewHideWhitespace;
const fileListHidden = preferences.reviewFileListHidden;
const conversationShown = preferences.reviewConversationShown;
const threadsInCollapsed = preferences.reviewThreadsInCollapsed;
const selected = shallowRef<ReadonlySet<string>>(new Set());
/** The left column is off its top: the stack's bar shows over the rows going by (D25). */
const leftScrolled = shallowRef(false);
/** The diff's line cursor (D44): see {@link useReviewCursor}. */
const cursor = shallowRef<ReviewCursor | null>(null);
/** Still on its way to where it opens: see {@link useReviewPosition}. */
const landing = shallowRef(true);
/** Why it opened where it did, for the status bar, until the first move: `landing` is over long before that. */
const arrival = shallowRef<ReviewArrival | null>(null);
/** The comment box the keys are in; it takes them back when its row returns to the list's window. */
const focusedBox = shallowRef<string | null>(null);
/** The box sent last, which takes the keys back if GitHub refuses it. */
const sentBox = shallowRef<string | null>(null);
/**
 * Lines being chosen for a comment (CR73): dragged from a line's number or comment button, or taken from the cursor's line by
 * ⇧↓ ⇧↑, the cursor on the end they move.
 */
const lineRange = shallowRef<LineRange | null>(null);
/** The keys are in a text field, where V or C would be typed: the cursor shows only by a line's comment buttons (D44). */
const keysInField = shallowRef(isEditableTarget(document.activeElement));
const submitOpen = shallowRef(false);
const discardOpen = shallowRef(false);
/** The thread just resolved here, while N and ⇧N are still at it: they go on through the open ones (CR15). */
const justResolved = shallowRef<string | null>(null);
/**
 * The cursor N or ⇧N put on a thread, while it is still there: every move makes a new cursor. The walk ends at its last
 * thread, but a thread reached otherwise is a row N goes on from (CR15, D44).
 */
let walkedCursor: ReviewCursor | null = null;
/** The files threads were just resolved in here: hidden as viewed or gone with them, they'd take the place being read (D7). */
const heldFiles = shallowRef<ReadonlySet<string>>(new Set());

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

  for (const { id, path, side, startLine, line, threadId } of commentTargets.value) {
    // A reply is on its thread's lines already.
    if (threadId === null && canEdit(id)) {
      add(path, side, startLine ?? line, line);
    }
  }

  const range = lineRange.value;
  if (range) {
    add(range.path, range.side, Math.min(range.from, range.to), Math.max(range.from, range.to));
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
  const held = [...heldFiles.value].filter(path => !allFiles.value.some(file => file.path === path));
  return [...new Set([...placements.value.goneEntries, ...unlisted, ...held])].map((path): ReviewFile => ({
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
        file =>
          file.viewed !== 'VIEWED' ||
          openThreads.value.has(file.path) ||
          commentPaths.value.has(file.path) ||
          heldFiles.value.has(file.path),
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
const listGroups = computed((): readonly ReviewFileGroup[] =>
  filterOn.value && ordered.value.length > 0 ? [{ kind: 'root', files: ordered.value }] : groups.value,
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
/**
 * The file V, Space and C act on, the cursor's (D44). Before there is a cursor, the one landed on: what is fetched and
 * computed first, near the place kept.
 */
const currentPath = computed(() => {
  const key = cursor.value?.key;
  if (key !== undefined) {
    return getReviewRowPath(key);
  }

  return (landing.value ? findLandingPath() : null) ?? ordered.value[0]?.path ?? null;
});
const { rows: fileRows, threadPlacements } = useReviewRows({
  files,
  ordered,
  layout,
  hideWhitespace,
  currentPath,
  threadsInCollapsed,
  commentTargets,
});
watch(threadPlacements, next => (placements.value = next), { flush: 'sync', immediate: true });
/** CR63: with every file viewed and those hidden, what is left stays under a block saying so. */
const allViewedShown = computed(
  () =>
    files.value?.listComplete === true &&
    hideViewed.value &&
    !filterOn.value &&
    allFiles.value.length > 0 &&
    allFiles.value.every(file => file.viewed === 'VIEWED'),
);
const rows = computed((): readonly ReviewRow[] => {
  const [first] = ordered.value;
  return allViewedShown.value && first && fileRows.value.length > 0
    ? [{ kind: 'allViewed', key: getReviewAllViewedKey(first.path) }, ...fileRows.value]
    : fileRows.value;
});
/**
 * The comment on the code the address's fragment names (`#discussion_r…`, or GitHub's `#r…`): the review lands on its
 * thread instead of where it was left, and drops the fragment once landed or given up.
 */
const linkAnchor = shallowRef<string | null>(null);
/** The link already opened its file, or let it past the filter and hidden viewed files: once only. */
let linkOpenedFile = false;
const linkPending = computed(() => landing.value && linkAnchor.value !== null);
const linkedThread = computed(() => {
  const anchor = linkAnchor.value;
  const current = files.value;
  return anchor === null || !current
    ? null
    : findLinkedThread({
        anchor,
        threads: current.threads,
        threadsState: current.threadsState,
        placements: placements.value.byFile,
        listEnd: current.listEnd,
      });
});
useReviewPosition({ files, rows, ordered, order: allPaths, list, landing, held: linkPending, arrival });
const reviewCursor = useReviewCursor({
  cursor,
  list,
  rows,
  diffColumn,
  order: allPaths,
  isDragging: () => lineRange.value?.dragging === true,
  onMove: stopLanding,
});
/** The row holding the cursor. */
const cursorRow = computed(() => {
  const key = cursor.value?.key;
  return key === undefined ? null : (rows.value.find(row => row.key === key) ?? null);
});
/** The thread under the cursor, which R replies in and N and ⇧N go on from (D44). */
const focusedThread = computed(() => (cursorRow.value?.kind === 'thread' ? cursorRow.value.placement.thread.id : null));
const githubUrl = computed(() => {
  const { owner, name, number } = props.reference;
  return getGitHubUrl(`${owner}/${name}/pull/${number}/files`);
});
/** The file in view, unless it is a gone one's entry, which can't be marked, selected or collapsed. */
const currentFile = computed(() => {
  const file = ordered.value.find(({ path }) => path === currentPath.value);
  return file && !file.gone ? file : null;
});
const branches = computed(() => (opened.item?.kind === 'pullRequest' ? opened.item : null));
const detail = computed(() => (opened.detail?.kind === 'pullRequest' ? opened.detail : null));
const pendingReview = computed(() => branches.value?.pendingReview ?? null);
const finish = computed(() => writing.value?.finish ?? REVIEW_FINISH_IDLE);
const pendingComments = computed(() => getPendingComments(files.value?.threads ?? []));
const submission = computed({
  get: () => writing.value?.submission ?? NO_REVIEW_SUBMISSION,
  set: choice => writing.value?.setSubmission(choice),
});
const commentDraft = computed({
  get: () => (opened.id === null ? '' : commentDrafts.get(opened.id)),
  set: text => {
    if (opened.id !== null) {
      commentDrafts.set(opened.id, text);
    }
  },
});
/** The user's comments on the pull request GitHub did not take, and their edits of its comments and description. */
const failedComments = computed(() => (opened.id === null ? [] : commentDrafts.getFailed(opened.id)));
const failedEdits = computed(() => (opened.id === null ? [] : commentDrafts.getFailedEdits(opened.id)));
/** Who opened the pull request and who commented on it: whom `@` suggests first in the conversation's editors. */
const conversationPeople = computed(() =>
  filterNotNull([opened.item?.author ?? null, ...(detail.value?.comments.nodes ?? []).map(comment => comment.author)]),
);
const lostViewed = computed(() => files.value?.lostViewed ?? NO_FILES);
/** By file, while there is a box to suggest in: what each has its lines in. */
const diffsByPath = computed(() => {
  const diffs = new Map<string, FileDiff>();
  if (commentTargets.value.length > 0) {
    for (const row of rows.value) {
      if (row.kind === 'line') {
        diffs.set(getReviewRowPath(row.key), row.diff);
      }
    }
  }

  return diffs;
});
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

const nextNumber = computed(() => {
  const id = nextPullRequest.value;
  return (id === null ? undefined : details.getItem(id))?.number ?? null;
});
const openThreadCount = computed(() => {
  let total = 0;
  for (const count of openThreads.value.values()) {
    total += count;
  }

  return total;
});

const openedAt = performance.now();
let firstRowMeasured = false;
/** Where ⇧click selects from: the file last selected on its own. */
let selectionStart: string | null = null;
/** The row under lines being expanded, at where it is on screen: it stays there once they are in. */
let heldInExpanding: { key: string; offset: number } | null = null;
const walkedBy = navigation.takeReviewWalk(formatItemReference(props.reference));
/** Opened from the list of drafts to submit it (CR34): the dialog opens as soon as the draft is known. */
let submitAsked = navigation.takeReviewSubmit(formatItemReference(props.reference));

watch(
  pendingReview,
  draft => {
    if (submitAsked && draft) {
      submitAsked = false;
      submitOpen.value = true;
    }
  },
  { immediate: true },
);

// The text is safe on disk, but a reload under a typing hand would take the box from it.
onScopeDispose(holds.holdWhile(() => writing.value?.hasText ?? false));
// Its toast goes with the review: coming back, there is nothing to restore.
onScopeDispose(() => writing.value?.forgetDiscarded());

// Once, when the diff first shows: the arrows and PageDown then move its cursor at once, Home and End scroll it. By then the
// user may be in a field, like the command palette's, which nothing here takes them out of.
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

// A link to a comment on the code, on opening or while here (from an item opened over the review): it lands anew. Only
// the review's own address: leaving for the pull request's page, its fragment is that page's.
watch(
  () => (route.name === 'review' ? route.hash : ''),
  hash => {
    const anchor = parseThreadAnchor(hash);
    if (anchor !== null) {
      linkAnchor.value = anchor;
      linkOpenedFile = false;
      landing.value = true;
      arrival.value = null;
    }
  },
  { immediate: true },
);
watch([list, rows, linkedThread], landOnLink, { flush: 'post' });
// Landed on the thread, or moved by the reader first: the link is done.
watch(landing, now => {
  if (!now) {
    endLink();
  }
});

// Signed in again as someone else, this is their read of the pull request.
watch(
  () => accounts.current,
  () => {
    files.value = reviewFiles.open(props.reference);
    landing.value = true;
    arrival.value = null;
    cursor.value = null;
  },
);

// Landed, the cursor starts on the first stop under the pinned header, in the file landed on, moving nothing (D44); not
// once the reader moved it. At once, for a jump ending the landing to put it on its own row after that.
watch(
  landing,
  (now, before) => {
    if (before && !now && !cursor.value) {
      placeLandedCursor();
    }
  },
  { flush: 'sync' },
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

// The files kept in the diff after leaving it go as the top of the screen moves on, not when the reading line passes
// them: what is read stays in place (D7). One that is itself at the top stays until it leaves it. Not by `anchor`, which a
// jump makes the row jumped to, wherever on screen.
watch(
  () => {
    const [top] = list.value?.getShownRows() ?? [];
    return top ? getReviewRowPath(top.row.key) : null;
  },
  path => {
    const kept = path !== null && heldFiles.value.has(path) ? new Set([path]) : new Set<string>();
    if (heldFiles.value.size > kept.size) {
      heldFiles.value = kept;
    }
  },
);

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
  // What says all is viewed comes in above the rows: it shows to a reader at their very top, or whose file went with it (CR63).
  const allViewed = next[0]?.kind === 'allViewed' && previous[0]?.kind !== 'allViewed' ? next[0] : null;
  const fileGone = anchor && replacement && getReviewRowPath(replacement.row.key) !== getReviewRowPath(anchor.key);
  if (allViewed && (fileGone || (anchor?.key === next[1]?.key && anchor?.offset === 0))) {
    void nextTick(() => list.value?.jumpTo(allViewed.key, 0));
  } else if (replacement) {
    // The file read went, filtered away or hidden as viewed: the one taking its place shows where it was (D9), the cursor
    // going on to it with its own rule (`findCursorAfterRows`).
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

// Along whatever of a line the pointer is over, its number, its comment button's column or its code: its line on the range's side.
onWindowEvent(
  'pointermove',
  event => {
    const range = lineRange.value;
    if (range?.dragging && event.target instanceof Element) {
      const key = event.target.closest('[data-cursor-key]')?.getAttribute('data-cursor-key');
      const row = rows.value.find(other => other.key === key);
      const line = row && getReviewRowPath(row.key) === range.path ? getRowLineOn(row, range.side) : null;
      if (line !== null) {
        lineRange.value = {
          ...range,
          to: clampCommentRange({ ...range, rows: rows.value, line: range.from, to: line }),
        };
      }
    }
  },
  { passive: true },
);

onWindowEvent('pointerup', () => {
  const range = lineRange.value;
  if (range?.dragging) {
    lineRange.value = null;
    if (range.from !== range.to) {
      startRange(range);
    }
  }
});

// The keys' range goes once the cursor leaves the line it ends on: another key, the pointer, a jump.
watch(cursorRow, row => {
  const range = lineRange.value;
  if (
    range &&
    !range.dragging &&
    !(row && getReviewRowPath(row.key) === range.path && getRowLineOn(row, range.side) === range.to)
  ) {
    lineRange.value = null;
  }
});

onWindowEvent('focusin', event => {
  keysInField.value = isEditableTarget(event.target);
  // Gone elsewhere in the app: a box coming back into the window doesn't take the keys from there.
  if (event.target instanceof Node && !diffColumn.value?.contains(event.target)) {
    focusedBox.value = null;
  }
});

// Where the keys go, or nowhere when the window loses them.
onWindowEvent('focusout', event => {
  keysInField.value = isEditableTarget(event.relatedTarget);
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

useReviewKeySheet();

/**
 * The pull request reviewed, while its actions are the keys' and the menu's: not with an item opened over the review,
 * whose own they then are, as a list's row yields to it.
 */
const actingPullRequest = computed(() =>
  opened.item?.kind === 'pullRequest' && !getOpenedItemRoute(route) ? opened.item : null,
);
const pullRequestCommands = useItemCommands({
  ids: () => (actingPullRequest.value ? [actingPullRequest.value.id] : []),
  section: () => 'item',
  open: () => {},
  // The merge panel opens over the review, which stays where it is once the merge is sent.
  merge: merging ? pr => merging.open(pr.id) : undefined,
});
// The pull request's own actions, as in an opened one: merging, its branch, its checks, assignees, labels, closing.
useCommands(
  () => (actingPullRequest.value ? pullRequestCommands.getEditCommands() : []),
  () => {
    const pr = actingPullRequest.value;
    return pr ? { kind: 'item', label: formatShortReference(pr), title: pr.title } : null;
  },
);

useCommands(() => [
  {
    id: 'review.nextPullRequest',
    title: t(l.nextPullRequest),
    section: 'view',
    key: REVIEW_KEYS.nextPullRequest,
    icon: ChevronDown,
    when: () => nextPullRequest.value !== null,
    run: () => stepPullRequest(nextPullRequest.value, 'K'),
  },
  {
    id: 'review.previousPullRequest',
    title: t(l.previousPullRequest),
    section: 'view',
    key: REVIEW_KEYS.previousPullRequest,
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
    key: REVIEW_KEYS.previousFile,
    icon: ArrowUpToLine,
    when: () => ordered.value.length > 0,
    run: () => stepFile(-1),
  },
  {
    id: 'review.nextFile',
    title: t(l.nextFile),
    section: 'view',
    key: REVIEW_KEYS.nextFile,
    icon: ArrowDownToLine,
    when: () => ordered.value.length > 0,
    run: () => stepFile(1),
  },
  {
    id: 'review.nextThread',
    title: t(l.nextThread),
    section: 'view',
    key: REVIEW_KEYS.nextThread,
    icon: MessageSquare,
    when: () => walkedThreads.value.length > 0,
    run: () => stepThread(1),
  },
  {
    id: 'review.previousThread',
    title: t(l.previousThread),
    section: 'view',
    key: REVIEW_KEYS.previousThread,
    icon: MessageSquare,
    when: () => walkedThreads.value.length > 0,
    run: () => stepThread(-1),
  },
  {
    id: 'review.comment',
    title: t(l.commentOnLine),
    section: 'view',
    key: REVIEW_KEYS.comment,
    icon: MessageSquarePlus,
    // Always here, or with no files it would fall to a new issue, which the menu still offers: with no line on screen it does nothing.
    run: () => {
      const range = lineRange.value;
      const line = findCursorLine();
      if (range) {
        lineRange.value = null;
        startRange(range);
      } else if (line) {
        startComment({ path: line.path, side: line.side, line: line.line, startLine: null, threadId: null });
      }
    },
  },
  {
    id: 'review.reply',
    title: t(l.replyInThread),
    section: 'view',
    key: REVIEW_KEYS.reply,
    icon: Reply,
    when: () => findFocusedThread()?.placement.thread.viewerCanReply === true,
    run: () => {
      const row = findFocusedThread();
      if (row) {
        startReply(row);
      }
    },
  },
  {
    id: 'review.rangeDown',
    title: t(l.rangeDown),
    section: 'view',
    key: REVIEW_KEYS.rangeDown,
    menu: false,
    when: () => lineRange.value !== null || findCursorLine() !== null,
    run: () => stepLineRange(1),
  },
  {
    id: 'review.rangeUp',
    title: t(l.rangeUp),
    section: 'view',
    key: REVIEW_KEYS.rangeUp,
    menu: false,
    when: () => lineRange.value !== null || findCursorLine() !== null,
    run: () => stepLineRange(-1),
  },
  {
    id: 'review.clearRange',
    title: t(l.clearRange),
    section: 'view',
    key: 'Escape',
    menu: false,
    when: () => lineRange.value !== null && !isLayerOpen(),
    run: () => {
      lineRange.value = null;
    },
  },
  {
    id: 'review.submit',
    title: t(l.submitReview),
    section: 'view',
    key: REVIEW_KEYS.submit,
    icon: Send,
    // With no draft a review of no comments, which names the head read: not before there is one (D33).
    when: () => finish.value.kind !== 'sending' && (pendingReview.value !== null || files.value?.headRefOid != null),
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
    key: REVIEW_KEYS.viewed,
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
    key: REVIEW_KEYS.select,
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
    key: REVIEW_KEYS.selectNext,
    when: () => canSelect(),
    run: () => extendSelection(1),
  },
  {
    id: 'review.selectPrevious',
    title: t(l.selectPrevious),
    section: 'view',
    key: REVIEW_KEYS.selectPrevious,
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
  // Last of what Esc does, the box's own, the selection and the filter going first. Not with a layer open, whose Esc that is,
  // though the menu, a layer itself, offers it.
  {
    id: 'review.back',
    title: t(l.backToPullRequest),
    section: 'view',
    key: REVIEW_KEYS.back,
    icon: ArrowLeft,
    when: () => registry.menu !== null || !isLayerOpen(),
    run: back,
  },
  {
    id: 'review.openOnGitHub',
    title: t(l.openOnGitHub),
    section: 'view',
    key: REVIEW_KEYS.openOnGitHub,
    icon: Github,
    run: () => browser.openInNewTab(githubUrl.value),
  },
  // Only the diff's: the conversation and the file list scroll on their own.
  {
    id: 'review.lineDown',
    title: t(l.lineDown),
    section: 'view',
    key: REVIEW_KEYS.lineDown,
    icon: ArrowDown,
    when: isDiffScrollable,
    run: () => reviewCursor.move(1),
  },
  {
    id: 'review.lineUp',
    title: t(l.lineUp),
    section: 'view',
    key: REVIEW_KEYS.lineUp,
    icon: ArrowUp,
    when: isDiffScrollable,
    run: () => reviewCursor.move(-1),
  },
  {
    id: 'review.pageDown',
    title: t(l.pageDown),
    section: 'view',
    key: REVIEW_KEYS.pageDown,
    icon: ChevronsDown,
    when: isDiffScrollable,
    run: () => reviewCursor.page(1),
  },
  {
    id: 'review.pageUp',
    title: t(l.pageUp),
    section: 'view',
    key: REVIEW_KEYS.pageUp,
    icon: ChevronsUp,
    when: isDiffScrollable,
    run: () => reviewCursor.page(-1),
  },
  {
    id: 'review.focusFilter',
    title: t(l.focusFilter),
    section: 'view',
    key: REVIEW_KEYS.filter,
    icon: ListFilter,
    run: () => void focusFilter(),
  },
  {
    id: 'review.toggleFileList',
    title: fileListHidden.value ? t(l.showFileList) : t(l.hideFileList),
    section: 'view',
    key: REVIEW_KEYS.fileList,
    icon: PanelLeft,
    run: () => {
      fileListHidden.value = !fileListHidden.value;
    },
  },
  {
    id: 'review.toggleConversation',
    title: conversationShown.value ? t(l.hideConversation) : t(l.showConversation),
    section: 'view',
    key: REVIEW_KEYS.conversation,
    icon: PanelRight,
    run: () => {
      conversationShown.value = !conversationShown.value;
    },
  },
  {
    id: 'review.toggleLayout',
    title: layout.value === 'split' ? t(l.showUnifiedDiff) : t(l.showSplitDiff),
    section: 'view',
    icon: layout.value === 'split' ? Rows2 : Columns2,
    run: () => {
      layout.value = layout.value === 'split' ? 'unified' : 'split';
    },
  },
  {
    id: 'review.toggleHideWhitespace',
    title: hideWhitespace.value ? t(l.showWhitespaceChanges) : t(l.hideWhitespaceChanges),
    section: 'view',
    icon: Equal,
    run: () => {
      hideWhitespace.value = !hideWhitespace.value;
    },
  },
  {
    id: 'review.toggleThreadsInCollapsed',
    title: threadsInCollapsed.value ? t(l.hideCommentsInCollapsed) : t(l.showCommentsInCollapsed),
    section: 'view',
    icon: MessageSquare,
    run: () => {
      threadsInCollapsed.value = !threadsInCollapsed.value;
    },
  },
  {
    id: 'review.toggleHideViewed',
    title: hideViewed.value ? t(l.showViewed) : t(l.hideViewedFiles),
    section: 'view',
    icon: hideViewed.value ? Eye : EyeOff,
    // Hiding is the file list's setting: until the files are known there is nothing to set it on.
    when: () => files.value !== null,
    run: () => {
      hideViewed.value = !hideViewed.value;
    },
  },
  {
    id: 'review.toggleCollapsed',
    title: isCurrentCollapsed() ? t(l.expandFile) : t(l.collapseFile),
    section: 'view',
    key: REVIEW_KEYS.collapse,
    icon: isCurrentCollapsed() ? UnfoldVertical : FoldVertical,
    // Space on a focused button is that button's, wherever else the key goes.
    when: () => currentFile.value !== null && document.activeElement?.closest('button, a') == null,
    run: () => {
      if (currentFile.value) {
        toggleCollapsed(currentFile.value.path);
      }
    },
  },
  {
    id: 'review.showHiddenLines',
    title: t(l.showHiddenLines, { count: GAP_STEP }),
    section: 'view',
    key: REVIEW_KEYS.showHiddenLines,
    icon: ChevronsUpDown,
    when: () => findNearestGap() !== null,
    run: () => expandNearestGap(false),
  },
  // No key: ⇧E is the pull request's Re-run failed checks, which the review keeps (D42).
  {
    id: 'review.showAllHiddenLines',
    title: t(l.showAllHiddenLines),
    section: 'view',
    icon: ChevronsUpDown,
    when: () => findNearestGap() !== null,
    run: () => expandNearestGap(true),
  },
]);

function isDiffScrollable() {
  const focused = document.activeElement;
  return (
    registry.menu !== null || !focused || focused === document.body || diffColumn.value?.contains(focused) === true
  );
}

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

/** The file landed on: the one of the place kept, or of the row jumped to, the first file's header. */
function findLandingPath() {
  const position = files.value?.position;
  const anchor = list.value?.anchor;
  if (position) {
    return getReviewPlacePath(position.place);
  }

  return anchor ? getReviewRowPath(anchor.key) : null;
}

/**
 * Where the cursor starts once landed: the first stop under the pinned header; the header of the file landed on when that
 * stop is past it, or while its lines are still on their way, its threads waiting under the header for them.
 */
function placeLandedCursor() {
  const exposed = list.value;
  const top = exposed
    ? findCursorOnScreen({ rows: exposed.getShownRows(), viewport: exposed.getViewport(), edge: 'top' })
    : null;
  const path = findLandingPath();
  const header = path === null ? -1 : rows.value.findIndex(row => row.key === getReviewHeaderKey(path));
  const waiting = header !== -1 && isFileWaiting(rows.value, header);
  const inFile = top !== null && getReviewRowPath(top.key) === path && !waiting;
  const key = path === null || inFile ? top?.key : getReviewHeaderKey(path);
  if (key !== undefined) {
    reviewCursor.setTo(key);
  }
}

/** The reader scrolled: the end of the landing, the cursor brought along once it would leave the screen (D44). */
function onUserScroll(distance: number) {
  stopLanding();
  reviewCursor.followScroll(distance);
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

/**
 * A press on the pinned header's overlay: hovering it leaves the cursor, but a press is deliberate and holds its file, the
 * cursor on its header (D44). On the press, so the header's own buttons (Viewed moving on) act after it.
 */
function holdPinnedHeader(key: string) {
  stopLanding();
  reviewCursor.setTo(key);
  justResolved.value = null;
}

/** From the thread under the cursor through the threads walked; from any other row, the nearest thread that way. */
function stepThread(delta: 1 | -1) {
  const walked = walkedThreads.value;
  const at = walked.findIndex(row => row.placement.thread.id === focusedThread.value);
  const atRow = walked[at];
  const fromResolved =
    atRow?.placement.thread.isResolved && atRow.placement.thread.id === justResolved.value
      ? findOpenThreadFrom({ rows: rows.value, key: atRow.key, delta })
      : null;
  // Past either end of the walk (resolved threads come last): the walk ends there, but from a thread reached otherwise N
  // goes on as from any other row.
  const walking = at !== -1 && cursor.value === walkedCursor;
  const target =
    fromResolved ??
    (at === -1 ? undefined : walked[at + delta]) ??
    (walking ? null : findThreadFromRow({ rows: rows.value, key: cursor.value?.key ?? null, delta }));
  if (target) {
    jumpToThread(target);
  }
}

/**
 * The thread the address names, once it is known where: its row as N lands on it; its file let past the filter and hidden
 * viewed files and opened first if need be, its header held while its lines are on their way. A thread no file will show
 * gives way to the usual landing, one with no row in its file to the file's header.
 */
function landOnLink() {
  const linked = linkedThread.value;
  if (!linkPending.value || !linked || !list.value || linked.kind === 'waiting') {
    return;
  }

  if (linked.kind === 'missing') {
    endLink();
    return;
  }

  // Opened first: a collapsed file's thread may show under its header, on the code as it was, not on its line.
  const { path, threadId } = linked;
  if (!linkOpenedFile) {
    linkOpenedFile = true;
    if (openLinkedFile(path)) {
      return;
    }
  }

  const row = rows.value.find(other => other.key === getReviewThreadKey(path, threadId));
  if (row?.kind === 'thread') {
    jumpToThread(row);
    return;
  }

  const header = rows.value.findIndex(other => other.key === getReviewHeaderKey(path));
  if (header === -1) {
    endLink();
  } else if (isFileWaiting(rows.value, header)) {
    files.value?.prioritize(path);
    list.value.jumpTo(getReviewHeaderKey(path), 0);
  } else {
    jumpToFile(path);
  }
}

/** Whether anything had to change for the file to show the thread: the rows it changes bring the landing back. */
function openLinkedFile(path: string) {
  let changed = false;
  if (isHeldBack(path)) {
    filterPattern.value = '';
    hideViewed.value = false;
    changed = true;
  }

  if (getCollapse(path) !== null) {
    files.value?.setCollapsed(path, false);
    changed = true;
  }

  return changed;
}

/** Off the address too: Back, Forward and a reload come back to where the review was left, as without it. */
function endLink() {
  if (linkAnchor.value === null) {
    return;
  }

  linkAnchor.value = null;
  if (route.name === 'review' && parseThreadAnchor(route.hash) !== null) {
    void router.replace({ path: route.path, query: route.query, hash: '' });
  }
}

/** A quarter down the screen, the code above it in sight (CR15), and held there (D7). A resolved one opens, to be read. */
function jumpToThread(row: ReviewThreadRow) {
  const { id, isResolved } = row.placement.thread;
  if (isResolved) {
    files.value?.setThreadOpen(id, true);
  }

  stopLanding();
  reviewCursor.setTo(row.key);
  walkedCursor = cursor.value;
  justResolved.value = null;
  const height = list.value?.getViewport().height ?? 0;
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

/**
 * Shows lines of a gap, the row on the side they come from staying where it is on screen: it's what is being read (D7).
 * Going up, above the hunk below, that is the row under the gap; going down, the row over it.
 */
function expandGap(gap: ReviewGapRow, step: ReviewGapStep) {
  const index = rows.value.indexOf(gap);
  const held = rows.value[step.direction === 'up' ? index + 1 : index - 1];
  // A thread's distance mark goes with the gap: it's the thread that stays.
  const key =
    held?.kind === 'distance' ? getReviewThreadKey(getReviewRowPath(held.key), held.placement.thread.id) : held?.key;
  const offset = key === undefined ? null : (list.value?.getRowOffset(key) ?? null);
  heldInExpanding = key !== undefined && offset !== null ? { key, offset } : null;
  reviewCursor.noteExpanding(step.direction);
  files.value?.expandLines(getReviewRowPath(gap.key), getGapLinesToShow(gap, step));
  returnKeysToDiff();
}

/** The hunk a gap's lines come toward (D42): the one above for a gap below the reading line, the one below for a gap above it. */
function getGapToward(gap: ReviewGapRow): ReviewGapDirection {
  const shown = list.value?.getShownRows().find(({ row }) => row === gap);
  const viewport = list.value?.getViewport();
  if (!shown || !viewport) {
    return 'up';
  }

  return (shown.top + shown.bottom) / 2 > getReadingLine(viewport) ? 'down' : 'up';
}

/**
 * The gap E and "Show all hidden lines" open: the one under the cursor, or else the cursor's file's nearest it, the upper
 * of two as near; not one with nothing hidden, there only to say a push reset it (D42, D44).
 */
function findNearestGap(): ReviewGapRow | null {
  const key = cursor.value?.key;
  const at = rows.value.findIndex(row => row.key === key);
  if (key === undefined || at === -1) {
    return null;
  }

  const path = getReviewRowPath(key);
  let nearest: ReviewGapRow | null = null;
  let nearestDistance = Infinity;
  for (const [index, row] of rows.value.entries()) {
    const distance = Math.abs(index - at);
    if (row.kind === 'gap' && row.hidden > 0 && distance < nearestDistance && getReviewRowPath(row.key) === path) {
      nearest = row;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/** E: 20 lines of the gap at the cursor toward its hunk, each time it is pressed; or all of it (D42). */
function expandNearestGap(all: boolean) {
  const gap = findNearestGap();
  if (gap) {
    const step = getGapStep(gap, getGapToward(gap));
    expandGap(gap, all ? { direction: step.direction, count: getGapSize(gap) } : step);
  }
}

function jumpToFile(path: string) {
  stopLanding();
  reviewCursor.setTo(getReviewHeaderKey(path));
  justResolved.value = null;
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

/** What is known of a submodule's history, without asking for it: the list counts its commits once its block read them. */
function getSubmodule(path: string) {
  const state = getState(path);
  const change = state.kind === 'submodule' ? getSubmoduleChange(path, state) : null;
  return change && submodules.peek(change);
}

/** A submodule's change, by which its history is read; `null` while the head isn't known, which it is with any patch. */
function getSubmoduleChange(path: string, { before, after }: SubmodulePointers): ReviewSubmoduleChange | null {
  const headOid = files.value?.headRefOid ?? null;
  const { owner, name } = props.reference;
  return headOid === null ? null : { nameWithOwner: `${owner}/${name}`, headOid, path, before, after };
}

function isCurrentCollapsed() {
  return currentFile.value !== null && getCollapse(currentFile.value.path) !== null;
}

/** The cursor stays in the file, on its header once its lines go (D44): a second Space opens the same file again. */
function toggleCollapsed(path: string) {
  files.value?.setCollapsed(path, getCollapse(path) === null);
  returnKeysToDiff();
}

/**
 * Viewed, the current file collapses in place, or with viewed files hidden leaves the diff: either way the reader moves
 * on, and the next file is current (D9, D44).
 */
function toggleViewed(path: string) {
  const file = allFiles.value.find(other => other.path === path);
  const viewed = file?.viewed !== 'VIEWED';
  const index = ordered.value.findIndex(other => other.path === path);
  const next = viewed && path === currentPath.value ? ordered.value[index + 1] : undefined;
  if (next) {
    reviewCursor.setTo(getReviewHeaderKey(next.path));
  }

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

/**
 * The line C comments on, the cursor's (D32, D44): a code row's newer line, or its older with only that; a thread's own
 * line. None on a header, a gap or a thread on the file itself.
 */
function findCursorLine(): ReviewCommentLine | null {
  const row = cursorRow.value;
  if (row?.kind !== 'thread') {
    return row && getCommentLine(row);
  }

  const { placement } = row;
  return placement.kind === 'onLine' || placement.kind === 'hiddenLine'
    ? { path: getReviewRowPath(row.key), side: placement.side, line: placement.line, key: row.key }
    : null;
}

function startComment(target: Omit<ReviewCommentTarget, 'id'>) {
  const box = writing.value?.open(target);
  if (box) {
    stopLanding();
    focusedBox.value = box.id;
    placeCursorAtBox(box);
    void revealComment(box);
  }
}

/** The cursor on what a box is under: its thread for a reply, else its line, for the keys to go on from there (D44). */
function placeCursorAtBox({ path, side, line, threadId }: ReviewCommentTarget) {
  if (threadId !== null && isRowShown(getReviewThreadKey(path, threadId))) {
    reviewCursor.setTo(getReviewThreadKey(path, threadId));
    return;
  }

  // By the line, not by the box's row: a box just opened is not among the rows yet.
  const row = findLineRow(path, side, line);
  if (row) {
    reviewCursor.setTo(row.key);
  }
}

function findLineRow(path: string, side: DiffLineSide, line: number) {
  return rows.value.find(row => getReviewRowPath(row.key) === path && getRowLineOn(row, side) === line);
}

/** Only when it wouldn't fit on screen, and then by as little as it takes (D7). */
async function revealComment({ path, id, threadId }: ReviewCommentTarget) {
  await nextTick();
  const threadKey = threadId === null ? null : getReviewThreadKey(path, threadId);
  if (threadKey !== null && isRowShown(threadKey)) {
    revealReply(threadKey, id);
    return;
  }

  const key = getReviewCommentKey(path, id);
  const height = list.value?.getViewport().height ?? 0;
  const offset = list.value?.getRowOffset(key) ?? height;
  if (offset + COMMENT_BOX_HEIGHT > height) {
    list.value?.jumpTo(key, Math.max(height - COMMENT_BOX_HEIGHT, THREAD_MIN_OFFSET));
  }
}

/** A reply's box ends its thread (D39): the thread goes up by as much as the box reaches under the screen. */
function revealReply(threadKey: string, id: string) {
  const column = diffColumn.value;
  const box = column?.querySelector(`[data-box="${CSS.escape(id)}"]`);
  const top = list.value?.getRowOffset(threadKey) ?? null;
  if (!column || !box || top === null) {
    list.value?.jumpTo(threadKey, THREAD_MIN_OFFSET);
    return;
  }

  const below = box.getBoundingClientRect().bottom - column.getBoundingClientRect().bottom;
  if (below > 0) {
    list.value?.jumpTo(threadKey, top - below);
  }
}

/** ⇧click: the box being written on this side of the file now reaches the line, up to what hides lines from it (CR73). */
function extendComment(path: string, side: DiffLineSide, line: number) {
  const box = findOwnBox(path, side);
  if (!box) {
    startComment({ path, side, line, startLine: null, threadId: null });
    return;
  }

  const from = box.startLine ?? box.line;
  const to = clampCommentRange({ rows: rows.value, path, side, line: from, to: line });
  writing.value?.setRange(box.id, from === to ? null : Math.min(from, to), Math.max(from, to));
  focusedBox.value = box.id;
}

/** The box the keys are in, or else the last with room to change; a reply stays on its thread's lines. */
function findOwnBox(path: string, side: DiffLineSide) {
  const own = commentTargets.value.filter(
    target => target.threadId === null && canEdit(target.id) && target.path === path && target.side === side,
  );
  return own.find(target => target.id === focusedBox.value) ?? own.at(-1);
}

/** ⇧↓ ⇧↑ in an empty box: its range ends a line further, or a line sooner, never before it starts; the box follows into sight (D7). */
function extendBox(box: ReviewCommentTarget, delta: 1 | -1) {
  const { path, side, line } = box;
  const start = box.startLine ?? line;
  const end =
    delta === 1 ? clampCommentRange({ rows: rows.value, path, side, line, to: line + 1 }) : Math.max(start, line - 1);
  writing.value?.setRange(box.id, start === end ? null : start, end);
  void revealComment(box);
  void keepKeysInBox(box.id);
}

/** Under its new end line, the box may have been taken out of the page and put back, which drops the keys: back to it. */
async function keepKeysInBox(id: string) {
  await nextTick();
  const element = diffColumn.value?.querySelector(`[data-box="${CSS.escape(id)}"]`);
  if (element && !element.contains(document.activeElement)) {
    element.querySelector('textarea')?.focus();
  }
}

/**
 * ⇧↓ ⇧↑: the range from the cursor's line, or the one the keys are making, ends a line further that way, up to what hides
 * lines from it (CR73); the cursor goes to that line, the diff following as for ↓ ↑.
 */
function stepLineRange(delta: 1 | -1) {
  const current = lineRange.value;
  const line = current ? null : findCursorLine();
  const range =
    current ?? (line && { path: line.path, side: line.side, from: line.line, to: line.line, dragging: false });
  if (!range || range.dragging) {
    return;
  }

  const to = clampCommentRange({ ...range, rows: rows.value, line: range.from, to: range.to + delta });
  const row = findLineRow(range.path, range.side, to);
  if (to === range.to || !row) {
    return;
  }

  lineRange.value = { ...range, to };
  reviewCursor.stepTo(row.key, delta);
}

/** A box on the lines: one already written on a line of them takes them all, keeping its text, or else a new one. */
function startRange({ path, side, from, to }: LineRange) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const box = commentTargets.value.find(
    target =>
      target.threadId === null &&
      canEdit(target.id) &&
      target.path === path &&
      target.side === side &&
      target.line >= start &&
      (target.startLine ?? target.line) <= end,
  );
  if (!box) {
    startComment({ path, side, startLine: start === end ? null : start, line: end, threadId: null });
    return;
  }

  writing.value?.setRange(box.id, start === end ? null : start, end);
  focusedBox.value = box.id;
  void revealComment(box);
}

function findFocusedThread() {
  return walkedThreads.value.find(({ placement }) => placement.thread.id === focusedThread.value);
}

/** Its box under it: on its own lines, a resolved one opened to be read. */
function startReply(row: ReviewThreadRow) {
  const { thread } = row.placement;
  if (thread.isResolved) {
    files.value?.setThreadOpen(thread.id, true);
  }

  reviewCursor.setTo(row.key);
  justResolved.value = null;
  startComment({ path: getReviewRowPath(row.key), ...getReplyTarget(thread) });
}

/**
 * The thread folds or opens where it is, on screen, and at most under the pinned header when its top was above that: what is
 * being read of it is its end, by the button. Nothing above it moves, what comes after it follows (D7).
 */
function setThreadResolved(row: ReviewThreadRow, resolved: boolean) {
  const { id } = row.placement.thread;
  const offset = list.value?.getRowOffset(row.key) ?? null;
  stopLanding();
  reviewCursor.setTo(row.key);
  justResolved.value = resolved ? id : null;
  if (resolved) {
    files.value?.setThreadOpen(id, false);
    heldFiles.value = new Set([...heldFiles.value, getReviewRowPath(row.key)]);
  }

  writing.value?.setResolved(id, resolved);
  returnKeysToDiff();
  if (offset !== null) {
    void nextTick(() => list.value?.jumpTo(row.key, Math.max(offset, THREAD_MIN_OFFSET)));
  }
}

function findThread(id: string) {
  return files.value?.threads.find(thread => thread.id === id);
}

/** Its box, the one reply still being written or refused, and the replies on their way. */
function getThreadReplies({ replies }: ReviewThreadRow): ReviewThreadReplies {
  return { sent: replies.filter(reply => !canEdit(reply.id)), box: replies.find(reply => canEdit(reply.id)) ?? null };
}

/** Who a reply answers: who wrote in the thread, the viewer aside (CR74). */
function getReplyTo({ threadId }: ReviewCommentTarget) {
  const logins = new Set(findThread(threadId ?? '')?.comments.flatMap(comment => comment.author?.login ?? []));
  logins.delete(auth.viewer?.login ?? '');
  return logins.size > 0 ? formatList(logins) : null;
}

/** The block `⌘G` inserts, where GitHub would take a suggestion: on the newer side, in an open file, on a thread not outdated. */
function getSuggestion(target: ReviewCommentTarget) {
  const { threadId, path, side, startLine, line } = target;
  const thread = threadId === null ? null : findThread(threadId);
  const diff = diffsByPath.value.get(path);
  if (side !== 'after' || !diff || thread === undefined || thread?.isOutdated || thread?.subjectType === 'FILE') {
    return null;
  }

  const lines = getSuggestionLines({ diff, startLine: startLine ?? line, line, mustBeInHunk: thread === null });
  return lines && formatSuggestion(lines);
}

function onGutter(row: ReviewRow, event: MouseEvent, side: DiffLineSide, line: number) {
  const path = getReviewRowPath(row.key);
  switch (event.type) {
    case 'pointerdown':
      lineRange.value =
        event.button === 0 && !event.shiftKey ? { path, side, from: line, to: line, dragging: true } : null;
      break;
    case 'click':
      if (event.shiftKey) {
        extendComment(path, side, line);
      } else {
        startComment({ path, side, line, startLine: null, threadId: null });
      }

      break;
    default:
      break;
  }
}

function onRowFocusLost(key: string) {
  const box = commentTargets.value.find(({ id, path, threadId }) =>
    threadId === null || !isRowShown(getReviewThreadKey(path, threadId))
      ? getReviewCommentKey(path, id) === key
      : canEdit(id) && getReviewThreadKey(path, threadId) === key,
  );
  if (box) {
    focusedBox.value = box.id;
  }
}

function isRowShown(key: string) {
  return rows.value.some(row => row.key === key);
}

/** The keys back to the diff, the cursor on its line or thread. */
function sendComment(target: ReviewCommentTarget, way: ReviewCommentWay) {
  sentBox.value = target.id;
  focusedBox.value = null;
  placeCursorAtBox(target);
  writing.value?.send(target.id, way);
  returnKeysToDiff();
}

/** Escape on an empty box: it goes, and the keys are the diff's again, the cursor on its line or thread. */
function leaveComment(target: ReviewCommentTarget) {
  focusedBox.value = null;
  placeCursorAtBox(target);
  writing.value?.close(target.id);
  list.value?.focus();
}

/** Discarded with its text: the box goes, a toast offering it back (D40), and the keys are the diff's again. */
function discardComment(target: ReviewCommentTarget) {
  focusedBox.value = null;
  placeCursorAtBox(target);
  writing.value?.discardBox(target.id);
  list.value?.focus();
}

/** Back under its line or in its thread with its text and the keys, moving nothing unless it wouldn't fit (D7). */
function restoreComment() {
  const box = writing.value?.restoreDiscarded();
  if (box) {
    stopLanding();
    focusedBox.value = box.id;
    placeCursorAtBox(box);
    void revealComment(box);
  }
}

function onCommentBlur(id: string) {
  if (focusedBox.value === id) {
    focusedBox.value = null;
  }
}

/** On the pull request itself, as on an opened item: it goes out at once (D17), kept in its composer if GitHub refuses. */
function commentOnPullRequest(body: string) {
  editPullRequest({ kind: 'comment', body });
}

/** A comment or the description edited, or a comment deleted, from the conversation. */
function editPullRequest(request: EditRequest) {
  if (opened.id !== null) {
    void editor.edit([opened.id], request);
  }
}

function discardFailedEdit(commentId: string | null) {
  if (opened.id !== null) {
    commentDrafts.discardFailedEdit(opened.id, commentId);
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

function retryFinish() {
  writing.value?.retry();
  returnKeysToDiff();
}

function dismissFinish() {
  writing.value?.dismiss();
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
    <ColumnSplit
      :shown="!fileListHidden"
      :width="FILE_LIST_WIDTH"
      :label="t(l.resizeFileList)"
    >
      <template #column>
        <div
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
            :get-submodule="getSubmodule"
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
      </template>
      <ColumnSplit
        :shown="conversationShown"
        :width="CONVERSATION_WIDTH"
        :label="t(l.resizeConversation)"
        side="right"
      >
        <template #column>
          <div :class="css.reviewView_conversation">
            <ReviewConversation
              v-model:comment-draft="commentDraft"
              :item="opened.item"
              :detail="detail"
              :review-threads="reviewThreads"
              :load-older="opened.loadAllComments"
              :load-older-reviews="opened.loadAllReviews"
              :draft-open="writing?.draftOpen ?? false"
              :comment-disabled="opened.item ? !editor.getPermissions(opened.item).comment : true"
              :viewer="auth.viewer"
              :failed-comments="failedComments"
              :failed-edits="failedEdits"
              :people="conversationPeople"
              @comment="commentOnPullRequest"
              @edit="editPullRequest"
              @discard-edit="discardFailedEdit"
              @retry="editor.retryComment($event)"
              @discard="commentDrafts.discardFailed($event)"
              @close="conversationShown = false"
              @jump-to-threads="jumpToReviewThreads"
            />
          </div>
        </template>
        <!-- The box's inset, for the pending toolbar to keep its content to the box. -->
        <div
          :class="css.reviewView_diffColumn"
          :style="{ '--review-diff-inset': `${diffInset}px` }"
        >
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
              :push-room="FILE_GAP"
              :top-room="FILE_GAP"
              :inset="diffInset"
              :label="t(l.diff)"
              @user-scroll="onUserScroll"
              @row-focus-lost="onRowFocusLost"
            >
              <template #default="{ row, pushed, pinned }">
                <ReviewAllViewed
                  v-if="row.kind === 'allViewed'"
                  :total="allFiles.length"
                  :thread-count="openThreadCount"
                  :thread-file-count="openThreads.size"
                  :next-number="nextNumber"
                  :sending="finish.kind === 'sending'"
                  @submit="submitOpen = true"
                  @next="stepPullRequest(nextPullRequest, 'K')"
                />
                <ReviewDiffRow
                  v-else
                  :row="row"
                  :github-url="githubUrl"
                  :submodule="row.kind === 'submodule' ? getSubmoduleChange(row.file.path, row) : null"
                  :changed-since="row.kind === 'header' && lostViewed.has(row.file.path)"
                  :thread-open="row.kind === 'thread' && isThreadOpen(row.placement.thread.id)"
                  :thread-replies="row.kind === 'thread' ? getThreadReplies(row) : null"
                  :viewer="auth.viewer"
                  :thread-failure="row.kind === 'thread' ? writing?.getResolveFailure(row.placement.thread.id) : null"
                  :commented="row.kind === 'line' ? commentedLines.get(getReviewRowPath(row.key)) : undefined"
                  :layout="layout"
                  :pushed="pushed"
                  :pinned="pinned"
                  :cursor="!pinned && cursor?.key === row.key"
                  :quiet="keysInField"
                  :current="getReviewRowPath(row.key) === currentPath"
                  :toward-gap="getGapToward"
                  @expand="expandGap"
                  @expand-to-thread="expandToThread"
                  @expand-to-file-end="expandToFileEnd"
                  @show-whitespace="hideWhitespace = false"
                  @toggle-thread="toggleThread"
                  @reply-in-thread="startReply"
                  @set-thread-resolved="setThreadResolved"
                  @retry="path => files?.retry(path)"
                  @toggle-collapsed="toggleCollapsed"
                  @toggle-viewed="toggleViewed"
                  @gutter="(event, side, line) => onGutter(row, event, side, line)"
                  @pointerdown="pinned && holdPinnedHeader(row.key)"
                >
                  <template #comment="{ target, inThread }">
                    <ReviewWrittenComment
                      :target="target"
                      :in-thread="inThread"
                      :data-box="target.id"
                      :repository="`${reference.owner}/${reference.name}`"
                      :item-number="reference.number"
                      :text="writing?.getText(target.id)"
                      :status="writing?.getStatus(target.id) ?? { kind: 'editing' }"
                      :draft-open="writing?.draftOpen ?? false"
                      :draft-count="writing?.draftCount ?? 0"
                      :draft-first="tracking.reviewCommentChoice === 'draft'"
                      :focused="focusedBox === target.id"
                      :author="auth.viewer ?? null"
                      :reply-to="getReplyTo(target)"
                      :suggestion="getSuggestion(target)"
                      :code-changed="writing?.hasCodeChanged(target.id)"
                      @extend="extendBox(target, $event)"
                      @update:text="writing?.setText(target.id, $event)"
                      @send="way => sendComment(target, way)"
                      @leave="leaveComment(target)"
                      @discard="discardComment(target)"
                      @focus="focusedBox = target.id"
                      @blur="onCommentBlur(target.id)"
                    />
                  </template>
                </ReviewDiffRow>
              </template>
            </AnchoredList>
            <!-- The diff's box over the list, taking no pointer but at its edges: the gaps beside it scroll the list. -->
            <div
              v-if="diffBoxStyle && ordered.length > 0"
              :class="css.reviewView_box"
              :style="diffBoxStyle"
            >
              <WidthHandle
                v-for="side in ['left', 'right'] as const"
                :key="side"
                v-model="diffWidth.current"
                :class="css.reviewView_edge"
                :side="side"
                :label="t(l.resizeDiff)"
                :min="DIFF_MIN_WIDTH"
                :max="diffRoom"
                @resized="diffWidth.save()"
              />
            </div>
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
                  <div :class="css.reviewView_actions">
                    <Button
                      size="sm"
                      variant="light"
                      :kbd="REVIEW_KEYS.submit"
                      :keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.submit)"
                      :busy="finish.kind === 'sending'"
                      @click="submitOpen = true"
                    >
                      {{ t(allViewedLoc.submit) }}
                    </Button>
                    <Button
                      v-if="nextNumber !== null"
                      size="sm"
                      :kbd="REVIEW_KEYS.nextPullRequest"
                      :keyshortcuts="formatAriaKeyShortcuts(REVIEW_KEYS.nextPullRequest)"
                      @click="stepPullRequest(nextPullRequest, 'K')"
                    >
                      {{ t(allViewedLoc.next, { number: nextNumber }) }}
                    </Button>
                    <Button
                      size="sm"
                      @click="hideViewed = false"
                    >
                      {{ t(l.showViewed) }}
                    </Button>
                  </div>
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
                      <Kbd :keys="REVIEW_KEYS.conversation" />
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
            <!-- The review's own: it goes with the review, at the foot of the diff's box, so above the pending toolbar (D40). -->
            <div
              :class="css.reviewView_foot"
              :style="diffBoxStyle"
            >
              <Toaster contained>
                <ReviewDiscardedToast
                  v-if="writing?.discarded"
                  :key="writing.discarded.target.id"
                  :discarded="writing.discarded"
                  @restore="restoreComment"
                  @close="writing?.forgetDiscarded()"
                />
              </Toaster>
            </div>
          </div>
          <ReviewPendingToolbar
            v-if="pendingReview || finish.kind !== 'idle'"
            :comment-count="pendingReview?.commentCount ?? 0"
            :has-draft="pendingReview !== null"
            :finish="finish"
            :can-retry="writing?.canRetry ?? false"
            :can-dismiss="writing?.canDismiss ?? false"
            @discard="discardOpen = true"
            @submit="submitOpen = true"
            @retry="retryFinish"
            @dismiss="dismissFinish"
          />
        </div>
      </ColumnSplit>
    </ColumnSplit>
    <ReviewSubmitDialog
      v-model:open="submitOpen"
      v-model:choice="submission"
      :number="reference.number"
      :comment-count="writing?.draftCount ?? 0"
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

// One scroller for the stack and the files: nothing here takes height from the diff, and what stops moves nothing (D25).
// No browser's own anchoring: where the files stay when a stack arrives is `ReviewView`'s, in the desktop app's too.
.reviewView_left {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overflow-anchor: none;
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

// Exactly the diff's box: its edges are the handles', the only part taking the pointer.
.reviewView_box {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}

.reviewView_box .reviewView_edge {
  pointer-events: auto;
}

// Of no height at the foot of the box, so it takes no pointer: the toasts stand above it, in its corner.
.reviewView_foot {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 0;
}

// The split draws the line beside it: none of its own, or it would be two.
.reviewView_conversation {
  flex: 1;
  min-height: 0;
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
