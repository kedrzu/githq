<!-- An opened issue or pull request (D9): the same view in a panel beside the screen or a page of its own. The header names the item and holds the way through the list (`K`/`J`, "3 / 13"), the other arrangement — "Open full screen" in the panel, "Back to the panel" on a page, not offered there when the window has no room for the panel (`ItemNavigation.panelFits`); also `⇧Enter`, never from a text field — GitHub (`O`) and close (`Esc`, which the owner may take as a step back to the panel); its reference (`skyline-labs/portal #1187 ▾`) opens the item menu (M1–M2, also `⌘.`): every action the user may take on the item, grouped as a list's context menu groups them, each with its key. Its width below the header decides the layout, not the arrangement (measured, `twoColumns`): a summary — the stack, the heading, where a pull request stands (`PullRequestMerge`), its reviews and checks, what it closes, the properties and projects — then the timeline (`ItemThread`). Narrower than 1000px on a page, 1300px in the panel (a panel that wide is dragged so on purpose), they scroll as one column, the panel as it always was and a page centred at the reading width; from there they stand side by side, each scrolling on its own: the summary pinned at the left in a column of its own (`ColumnSplit`: 440px by default, its edge dragged or moved by the arrow keys from 360 to 560px, the width kept on this device, the timeline keeping 560px), the timeline beside it at most the reading width, the rest of the width left empty. Unlike the app's other columns the two are one surface, the edge between them drawn only while hovered and both columns' content 32px from it, so it lies midway between them; the summary moves between the two places as it is (`Teleport`), nothing in it remounted. A pull request in a stack shows the stack's map (`StackMap`, stacked PRs D25, D27): in one column the stack bar (`StackBar`) is pinned above the content and the map's rows are the content's first block, scrolling away under the bar like the rest — nothing above the content ever changes height; once they are out of view a click on the bar drops a copy of them over the content, sliding out of the bar (D38), closed by Escape, a click outside, any scroll of the content, opening a pull request or the rows coming back into view; every pull request of the stack opens at the top, its rows in view; in two columns there is no bar, the map naming the stack at the top of the summary. The thread ends in the composer (`ItemThreadComposer`), scrolling with the rest — nothing is pinned to the bottom: `R` brings it into view and puts the cursor in it (⌘↵ posts); for a pull request `D` opens its review and `⇧O` its changed files on GitHub. With `editing`, what the user may change is changed here (M3): `A`, `L`, `M` open the pickers of assignees, labels and milestone, `S`, `P`, `I` those of the first project's status, priority and iteration, `⇧R` asks for reviews, `⇧M` opens the merge panel for a pull request the user may merge (merging D9), `T` the issue type's, and `⇧X` closes or reopens it as the composer's button does — an issue as completed, not planned being in the button's menu and the item menu. What the user may not change is shown but not offered (K1b). -->
<script lang="ts" setup>
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { useIntersectionObserver } from '@nzyme/vue-utils/useIntersectionObserver.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  CircleCheckBig,
  CircleSlash,
  GitPullRequestClosed,
  ChevronDown,
  FileDiff,
  GitBranch,
  Hash,
  Github,
  Link,
  MessageSquare,
  SquareKanban,
  RotateCcw,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

import CommandMenuSections from '@/commands/CommandMenuSections.vue';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import type { Command, CommandOption } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import { EDIT_KEYS, useEditCommands } from '@/commands/useEditCommands.js';
import type { StateOption } from '@/commands/useEditCommands.js';
import { applyMarkdownTool } from '@/components/applyMarkdownTool.js';
import Avatar from '@/components/Avatar.vue';
import ColumnSplit from '@/components/ColumnSplit.vue';
import IconButton from '@/components/IconButton.vue';
import LabelPill from '@/components/LabelPill.vue';
import Menu from '@/components/Menu.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuSeparator from '@/components/MenuSeparator.vue';
import MenuShortcut from '@/components/MenuShortcut.vue';
import StatePill from '@/components/StatePill.vue';
import type { StatePillTone } from '@/components/StatePill.vue';
import type { FailedComment, FailedTextEdit } from '@/edits/CommentDrafts.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import { getItemKind } from '@/lists/utils/getItemKind.js';
import { countMergeChecks } from '@/merge/countMergeChecks.js';
import { isAutoMergeAllowed } from '@/merge/isAutoMergeAllowed.js';
import { MergeContext } from '@/merge/MergeContext.js';
import type { MergeCheck } from '@/merge/MergeTypes.js';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import type { ReviewWriting } from '@/review/writing/ReviewWriting.js';
import { Browser } from '@/services/Browser.js';
import { WINDOW_DRAG_REGION } from '@/shell/windowControls.js';
import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import type { Item } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { formatTimeAgo } from '@/utils/formatTimeAgo.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenKey } from '@/utils/isScreenKey.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { getItemMenuSections } from './getItemMenuSections.js';
import type { ItemEditing } from './ItemEditing.js';
import { ItemNavigation } from './ItemNavigation.js';
import ItemProjects from './ItemProjects.vue';
import ItemProperties from './ItemProperties.vue';
import { formatShortReference } from './itemRoutes.js';
import type { ItemArrangement, ItemReference } from './itemRoutes.js';
import * as l from './ItemView.loc.js';
import ItemWalkStepper from './ItemWalkStepper.vue';
import LinkedItems from './LinkedItems.vue';
import PullRequestChecks from './PullRequestChecks.vue';
import PullRequestMerge from './PullRequestMerge.vue';
import PullRequestReviews from './PullRequestReviews.vue';
import StackBar from './StackBar.vue';
import StackMap from './StackMap.vue';
import type { StackNeighbours } from './StackMap.vue';
import ItemThread from './thread/ItemThread.vue';
import ItemThreadComposer from './thread/ItemThreadComposer.vue';

/** From this width of the item below its header on a page, the summary and the timeline stand side by side. */
const TWO_COLUMNS_WIDTH = 1000;
/** The same in the panel: later, so a panel dragged a little wider does not already split. */
const PANEL_TWO_COLUMNS_WIDTH = 1300;
/**
 * The summary's column: 440 px by default, dragged from 360 to 560 px. The timeline keeps 560 px beside it, so at the
 * narrowest two columns the summary has its default width.
 */
const SUMMARY_WIDTH = { key: 'itemSummary', default: 440, min: 360, max: 560 };
const TIMELINE_MIN_WIDTH = 560;

const props = withDefaults(
  defineProps<{
    /** The item's row: what shows at once. */
    item: Item;
    /** Body, comments, checks, reviews and every project field; `null` while being read. */
    detail: ItemDetail | null;
    arrangement: ItemArrangement;
    /** Where the item is in the list it was opened from (1-based); `null` when it is not in one. */
    position?: { index: number; count: number } | null;
    /** The issues a pull request closes, those known. */
    closes?: readonly Item[];
    /** Epoch ms the ages are counted to. */
    now: number;
    /** Reads the middle of the thread not read yet, its events and comments (the fold, F5). */
    loadThreadMiddle: () => Promise<void>;
    /** None of its detail is on this device and GitHub did not give it (F16). */
    detailFailed?: boolean;
    /** Reads its detail again after {@link detailFailed}. */
    readDetailAgain?: () => Promise<void>;
    /** The address's fragment without `#` (`''` for none): the comment it names is shown and marked in the thread. */
    linkedAnchor?: string;
    /** What the user may change and the pickers offer; without it the view only shows. */
    editing?: ItemEditing | null;
    /** The stack a pull request is in, with two or more of its pull requests in the copy: its map shows (D25). */
    stack?: StackDescription | null;
    /** What `K` and `J` open from it: the stack's map marks those rows. */
    neighbours?: StackNeighbours | null;
    /**
     * A pull request's checks with which of them the base branch requires, once its merge options are read (merging
     * D13): a failing required one is tagged, and the standing weighs only the required ones, as the merge panel does.
     */
    mergeChecks?: readonly MergeCheck[] | null;
    /** The viewer may turn auto-merge on, as its merge options said; `null` until they are read. */
    viewerCanEnableAutoMerge?: boolean | null;
    /** The user's comments GitHub did not take, in the order they were written. */
    failedComments?: readonly FailedComment[];
    /** The user's edits of its comments and description GitHub did not take. */
    failedEdits?: readonly FailedTextEdit[];
    /** A pull request's review threads, as code review reads them: its thread's reviews hold them. */
    reviewThreads?: readonly ReviewThread[];
    /** They are being read, none read before: the thread is busy. */
    reviewThreadsLoading?: boolean;
    /** Code review's writing of the pull request: the viewer's draft review, replies and resolving go through it. */
    reviewWriting?: ReviewWriting | null;
    /** With no draft open, a reply starts one rather than goes at once: code review's setting (D17). */
    reviewDraftFirst?: boolean;
    /** When the user last looked at the item before opening it (`ItemLookedStore`): its thread marks what is new since. */
    lookedAt?: number | null;
    /** When the user opened the item: what they post after it does not move the thread's line. */
    openedAt?: number | null;
  }>(),
  // Vue reads a boolean prop not given as `false`: not given is not known.
  { viewerCanEnableAutoMerge: null },
);

const emit = defineEmits<{
  close: [];
  previous: [];
  next: [];
  /** "Open full screen" or "Back to the panel" (`⇧Enter`): the other arrangement is wanted. */
  arrange: [arrangement: ItemArrangement];
  /** A linked item was picked. */
  open: [reference: ItemReference];
  /** A pull request picked in the stack's map: it takes this one's place, as `K`/`J` do. */
  openInPlace: [id: string];
  /** `D`: the pull request's review (code review's D2, always a page of its own). */
  review: [];
  /** The user changed something. */
  edit: [request: EditRequest];
  /** A comment GitHub did not take is to be sent again. */
  retryComment: [id: number];
  /** A comment GitHub did not take is to be dropped. */
  discardComment: [id: number];
  /** An edit GitHub did not take, of a comment or (`null`) the description, was cancelled. */
  discardEdit: [commentId: string | null];
  /** "Add to project" opened: the projects to offer are wanted. */
  needProjects: [];
  /** "Merge…" (`⇧M`): the merge panel is wanted for the pull request. */
  merge: [];
}>();

/** What is typed into the comment box and not posted yet. */
const commentDraft = defineModel<string>('commentDraft', { default: '' });
const t = useTranslate();
const browser = useService(Browser);
const navigation = useService(ItemNavigation);
/** Merging, where the screen offers it: how the session's last merge of a pull request ended (PM38). */
const merging = injectContext(MergeContext, { optional: true });
const pickerOptions = usePickerOptions();
const editCommands = useEditCommands();
const composerRef = useTemplateRef<InstanceType<typeof ItemThreadComposer>>('composer');
const threadRef = useTemplateRef<InstanceType<typeof ItemThread>>('thread');
const propertiesRef = useTemplateRef<InstanceType<typeof ItemProperties>>('properties');
const projectsRef = useTemplateRef<InstanceType<typeof ItemProjects>>('projects');
const reviewsRef = useTemplateRef<InstanceType<typeof PullRequestReviews>>('reviews');
const bodyRef = useTemplateRef<HTMLElement>('body');
const summaryColumnRef = useTemplateRef<HTMLElement>('summaryColumn');
const scrollRef = useTemplateRef<HTMLElement>('scroll');
const stackRowsRef = useTemplateRef<HTMLElement>('stackRows');
const stackBarRef = useTemplateRef<InstanceType<typeof StackBar>>('stackBar');
const stackDropRef = useTemplateRef<HTMLElement>('stackDrop');
const itemMenuOpen = ref(false);
/** In one column, the stack's rows at the top of the content are in view (D27): the bar has nothing to drop. */
const stackRowsInView = ref(true);
/** In one column, a copy of the stack's rows dropped from the bar over the content (D27, SP84). */
const stackDropped = ref(false);
/** The item's width below the header, panel or page: it decides the layout, not the arrangement. */
const bodyWidth = ref(0);
/** From {@link TWO_COLUMNS_WIDTH} or {@link PANEL_TWO_COLUMNS_WIDTH}: the summary in a column of its own, the timeline beside it. */
const twoColumns = computed(
  () => bodyWidth.value >= (props.arrangement === 'panel' ? PANEL_TWO_COLUMNS_WIDTH : TWO_COLUMNS_WIDTH),
);

// Measured before the first paint, so a page opens in two columns rather than one for a frame.
let bodyObserver: ResizeObserver | undefined;
onMounted(() => {
  const element = bodyRef.value;
  if (element) {
    bodyWidth.value = element.clientWidth;
    bodyObserver = new ResizeObserver(([entry]) => {
      if (entry) {
        bodyWidth.value = entry.contentRect.width;
      }
    });
    bodyObserver.observe(element);
  }
});
onBeforeUnmount(() => bodyObserver?.disconnect());

// D25: every pull request of a stack opens with its rows in view, and the router opens it at the top
// (`shell/routeScroll.ts`). Opening one takes the dropped rows away (D27).
watch(
  () => props.item.id,
  () => {
    stackDropped.value = false;
    if (props.stack) {
      stackRowsInView.value = true;
    }
  },
);

// The bar and its dropped rows are one column's: the layout changing takes them away.
watch(twoColumns, () => {
  stackDropped.value = false;
});

// D27: whether the rows at the top of the content are in view; back in view, the dropped copy has no reason to stay.
useIntersectionObserver({
  element: stackRowsRef,
  options: () => ({ root: scrollRef.value }),
  onVisible: () => {
    stackRowsInView.value = true;
    stackDropped.value = false;
  },
  onHidden: () => {
    stackRowsInView.value = false;
  },
});

/**
 * The other arrangement, offered by the header's button and `⇧Enter`: full screen from the panel, back to the panel from
 * the page — but not where the window has no room for the panel.
 */
const otherArrangement = computed((): OtherArrangement | null => {
  if (props.arrangement === 'panel') {
    return { arrangement: 'page', title: t(l.openFullScreen), icon: Maximize2 };
  }

  return navigation.panelFits ? { arrangement: 'panel', title: t(l.backToPanel), icon: Minimize2 } : null;
});

const pr = computed(() => (props.item.kind === 'pullRequest' ? props.item : null));
const issueDetail = computed(() => (props.detail?.kind === 'issue' ? props.detail : null));
const prDetail = computed(() => (props.detail?.kind === 'pullRequest' ? props.detail : null));
const requiredCheckIds = computed(() =>
  props.mergeChecks ? props.mergeChecks.filter(check => check.isRequired).map(check => check.id) : null,
);
const checkCounts = computed(() => (props.mergeChecks ? countMergeChecks(props.mergeChecks) : null));
const autoMergeAllowed = computed(() => isAutoMergeAllowed(props.editing?.metadata, props.viewerCanEnableAutoMerge));
const issueType = computed(() => (props.item.kind === 'issue' ? props.item.issueType : null));

const state = computed((): { icon: LucideIcon; tone: StatePillTone; text: string } => {
  const { item } = props;
  const kind = getItemKind(item);
  if (item.kind === 'pullRequest') {
    // Its state in words, by the tone of its icon.
    const key: `${StatePillTone}PullRequest` = `${kind.tone}PullRequest`;
    return { ...kind, text: t(l[key]) };
  }

  if (item.state === 'OPEN') {
    return { ...kind, text: t(l.open) };
  }

  switch (item.stateReason) {
    case 'NOT_PLANNED':
      return { ...kind, text: t(l.closedNotPlanned) };
    case 'DUPLICATE':
      return { ...kind, text: t(l.closedDuplicate) };
    default:
      return { ...kind, text: t(l.closedCompleted) };
  }
});

const permissions = computed(() => props.editing?.permissions ?? null);
/** Without `editing` nothing is known to stop a comment, as before the repository is read. */
const canComment = computed(() => props.editing == null || permissions.value?.comment === true);
/** Why the user can't comment, when the composer can say it: an archived repository, a locked conversation. */
const readOnly = computed(() => {
  const { editing } = props;
  if (!editing || canComment.value) {
    return null;
  }

  if (editing.metadata?.isArchived) {
    return 'archived';
  }

  return props.detail?.locked ? 'locked' : null;
});
const viewer = computed(() =>
  props.editing ? { login: props.editing.viewerLogin, avatarUrl: props.editing.viewerAvatarUrl } : null,
);
/** Who opened the item and who commented on it, in the thread's order: whom `@` suggests first. */
const threadPeople = computed(() =>
  filterNotNull([props.item.author, ...(props.detail?.comments.nodes ?? []).map(comment => comment.author)]),
);
const reviewerOptions = computed(() =>
  permissions.value?.reviewers && props.editing?.metadata
    ? pickerOptions.assignees([props.editing.metadata], props.editing.viewerLogin)
    : null,
);
/** The state menu's entries the user may use, for the item as it is. */
const stateActions = computed(() => {
  const { item } = props;
  const actions: StateOption[] = [];
  if (permissions.value?.state) {
    if (item.state === 'OPEN') {
      if (item.kind === 'issue') {
        actions.push(
          {
            key: 'completed',
            text: t(l.closeCompleted),
            icon: CircleCheckBig,
            request: { kind: 'close', reason: 'COMPLETED' },
          },
          {
            key: 'notPlanned',
            text: t(l.closeNotPlanned),
            icon: CircleSlash,
            request: { kind: 'close', reason: 'NOT_PLANNED' },
          },
        );
      } else {
        actions.push({
          key: 'close',
          text: t(l.closePullRequest),
          icon: GitPullRequestClosed,
          request: { kind: 'close', reason: 'COMPLETED' },
        });
      }
    } else if (!(item.kind === 'pullRequest' && item.merged)) {
      actions.push({ key: 'reopen', text: t(l.reopen), icon: RotateCcw, request: { kind: 'reopen' } });
    }
  }

  return actions;
});

const opened = computed(() => {
  const ago = formatTimeAgo(Date.parse(props.item.createdAt), props.now);
  const { author } = props.item;
  return { author, text: t(l.openedBy, { author: author?.login ?? t(l.deletedUser), ago }) };
});

/** The keys of the item's own actions; its edits' are `EDIT_KEYS`. */
const ITEM_KEYS = {
  openOnGitHub: 'O',
  openFiles: 'Shift+O',
  review: 'D',
  itemMenu: 'Mod+.',
  arrange: 'Shift+Enter',
} as const;

/**
 * The item menu's groups (M1–M2): the item's actions as a list's context menu lays them out — but GitHub, which has
 * its button beside it.
 */
const itemMenuSections = computed(() =>
  itemMenuOpen.value
    ? getItemMenuSections(
        [...getEditCommands(), ...getItemCommands()].filter(command => command.id !== 'item.openOnGitHub'),
        props.item.kind,
      )
    : [],
);

defineExpose({
  /** Puts the cursor in the comment box. */
  focusComposer: () => composerRef.value?.focus(),
  /**
   * Before the item is left: an edit with changes in its thread asks first (`true`), and the item stays; its Discard
   * calls `go`, to leave as the user was.
   */
  askToLeave: (go: () => void) => threadRef.value?.askToLeave(go) ?? false,
  /** An edit is open in the thread, changed or not (`ItemThread`); reactive. */
  hasOpenEditor: computed(() => threadRef.value?.hasOpenEditor ?? false),
});

// The item's actions: its edits (the inline pickers by their keys, their values in the command menu's submenus) and
// the rest — comment, reviews, GitHub, the link, the arrangement.
useCommands(
  () => [...getEditCommands(), ...getItemCommands()],
  () => ({
    kind: 'item',
    label: formatShortReference(props.item),
    title: props.item.title,
  }),
);

// Escape takes the dropped stack rows away, or else closes the item; `K`/`J` step through the list it was opened from (in a panel the list's own `j`/`k`, run first,
// move its selection instead, which the opened item follows).
onWindowEvent('keydown', event => {
  // An open picker or menu takes Escape for itself.
  if (event.key === 'Escape' && !event.defaultPrevented && !isLayerOpen()) {
    // Here rather than in a listener of the copy's own, which would run after this one. Not a `data-layer` either:
    // that would cover the screen and switch `J`/`K` off while the rows are dropped.
    if (stackDropped.value) {
      event.preventDefault();
      stackDropped.value = false;
      return;
    }

    // A field gives the key up first: Escape in the comment box leaves it.
    const { target } = event;
    if (target instanceof HTMLElement && isEditableTarget(target)) {
      target.blur();
      return;
    }

    event.preventDefault();
    emit('close');
    return;
  }

  if (!isScreenKey(event)) {
    return;
  }

  switch (event.key) {
    case 'j':
      event.preventDefault();
      emit('next');
      return;
    case 'k':
      event.preventDefault();
      emit('previous');
  }
});

// D27: a click outside the dropped rows and the bar takes them away; the bar's own click toggles them.
onWindowEvent('pointerdown', event => {
  const { target } = event;
  if (!stackDropped.value || !(target instanceof Node)) {
    return;
  }

  const bar = stackBarRef.value?.$el;
  if (stackDropRef.value?.contains(target) || (bar instanceof Node && bar.contains(target))) {
    return;
  }

  stackDropped.value = false;
});

/** Scrolling the content, either way, takes the dropped rows away: they belong to where the reader was. */
function onContentScroll() {
  stackDropped.value = false;
}

function getEditCommands(): Command[] {
  const { editing, item } = props;
  if (!editing) {
    return [];
  }

  return editCommands({
    section: 'item',
    items: [item],
    metadata: editing.metadata ? [editing.metadata] : [],
    loading: editing.metadata === null,
    viewerLogin: editing.viewerLogin,
    getPermissions: () => editing.permissions,
    places: (props.detail?.projects ?? []).filter(place => place.viewerCanUpdate),
    now: props.now,
    stateOptions: stateActions.value,
    stateTitle: getStateTitle(),
    edit,
    merge: () => emit('merge'),
    mergeChecks: checkCounts.value,
    viewerCanEnableAutoMerge: props.viewerCanEnableAutoMerge,
    pullRequestCommands: merging,
    checks: props.mergeChecks,
    setField: (place, field, value) =>
      emit('edit', { kind: 'projectField', projectItemId: place.itemId, fieldId: field.id, value }),
    inline: {
      assignees: () => propertiesRef.value?.openPicker('assignees') ?? false,
      labels: () => propertiesRef.value?.openPicker('labels') ?? false,
      milestone: () => propertiesRef.value?.openPicker('milestone') ?? false,
      issueType: () => propertiesRef.value?.openPicker('issueType') ?? false,
      reviewers: () => reviewsRef.value?.openPicker() ?? false,
      // Only an open issue has two ways to close: `⇧X` takes the usual one, as the composer's button does.
      state: () => {
        edit({ kind: 'close', reason: 'COMPLETED' });
        return true;
      },
      status: () => projectsRef.value?.openByRole('status') ?? false,
      priority: () => projectsRef.value?.openByRole('priority') ?? false,
      iteration: () => projectsRef.value?.openByRole('iteration') ?? false,
    },
  });
}

/**
 * A close of the item — by the composer's button, `⇧X` or a menu — takes what is typed in the comment box along: the
 * comment goes first, then the close, and the box empties. A reopen leaves it.
 */
function edit(request: EditRequest) {
  const body = commentDraft.value.trim();
  if (request.kind === 'close' && body) {
    emit('edit', { kind: 'comment', body, keptInThread: true });
    commentDraft.value = '';
  }

  emit('edit', request);
}

/**
 * Quote reply: the text quoted (`> ` on every line, then a blank line), without its HTML comments, after what is typed
 * in the comment box, which takes the cursor with its end in view.
 */
function quoteReply(body: string) {
  // Where the composer takes no comment, the quote would sit in a draft no one sees.
  if (!canComment.value) {
    return;
  }

  // HTML comments (an issue template's hints) render as nothing: quoted, they would show.
  const text = body
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  const quote = `${applyMarkdownTool(text, { start: 0, end: text.length }, 'quote').insert}\n\n`;
  const typed = commentDraft.value;
  commentDraft.value = typed.trim() ? `${typed.trimEnd()}\n\n${quote}` : quote;
  void composerRef.value?.focus();
}

function getItemCommands(): Command[] {
  const { item, editing } = props;
  const commands: Command[] = [
    {
      id: 'item.comment',
      title: t(l.comment),
      section: 'item',
      key: EDIT_KEYS.comment,
      icon: MessageSquare,
      when: () => canComment.value,
      run: () => void composerRef.value?.focus(),
    },
  ];
  if (permissions.value?.addToProject) {
    commands.push({
      id: 'item.addToProject',
      title: t(l.addToProject),
      section: 'item',
      icon: SquareKanban,
      prepare: () => emit('needProjects'),
      options: () => ({ loading: editing?.viewerProjects == null, options: getProjectOptions() }),
    });
  }

  // Its own keys (`onWindowEvent` above), listed in the help sheet.
  commands.push(
    { id: 'item.next', title: t(l.next), section: 'item', key: 'J', menu: false },
    { id: 'item.previous', title: t(l.previous), section: 'item', key: 'K', menu: false },
    { id: 'item.close', title: t(l.close), section: 'item', key: 'Escape', menu: false },
    {
      id: 'item.menu',
      title: t(l.itemMenu),
      section: 'item',
      key: ITEM_KEYS.itemMenu,
      menu: false,
      run: () => {
        itemMenuOpen.value = true;
      },
    },
  );

  commands.push(
    {
      id: 'item.openOnGitHub',
      title: t(l.openOnGitHub),
      section: 'item',
      key: ITEM_KEYS.openOnGitHub,
      icon: Github,
      run: () => browser.openInNewTab(item.url),
    },
    {
      id: 'item.review',
      title: t(l.review),
      section: 'item',
      key: ITEM_KEYS.review,
      icon: FileDiff,
      when: () => pr.value !== null,
      run: () => emit('review'),
    },
    {
      id: 'item.openFiles',
      title: t(l.openFiles),
      section: 'item',
      key: ITEM_KEYS.openFiles,
      icon: FileDiff,
      when: () => pr.value !== null,
      run: () => browser.openInNewTab(`${item.url}/files`),
    },
    {
      id: 'item.copyLink',
      title: t(l.copyLink),
      section: 'item',
      icon: Link,
      run: () => void navigator.clipboard.writeText(item.url),
    },
    {
      id: 'item.copyReference',
      title: t(l.copyReference),
      section: 'item',
      icon: Hash,
      detail: formatShortReference(item),
      run: () => void navigator.clipboard.writeText(`${item.repository.nameWithOwner}#${item.number}`),
    },
    {
      id: 'item.copyBranch',
      title: t(l.copyBranch),
      section: 'item',
      icon: GitBranch,
      detail: pr.value?.headRefName,
      when: () => pr.value !== null,
      run: () => void navigator.clipboard.writeText(pr.value?.headRefName ?? ''),
    },
  );

  const other = otherArrangement.value;
  if (other) {
    commands.push({
      id: `item.arrange.${other.arrangement}`,
      title: other.title,
      section: 'item',
      key: ITEM_KEYS.arrange,
      icon: other.icon,
      run: () => emit('arrange', other.arrangement),
    });
  }

  return commands;
}

function getStateTitle() {
  const { item } = props;
  if (item.state !== 'OPEN') {
    return t(l.reopen);
  }

  return item.kind === 'issue' ? t(l.closeIssueCommand) : t(l.closePullRequest);
}

function getProjectOptions(): CommandOption[] {
  const inProjects = new Set(props.item.projects.map(project => project.projectId));
  return (props.editing?.viewerProjects ?? [])
    .filter(project => !project.closed && !inProjects.has(project.id))
    .map(project => ({
      value: project.id,
      label: project.title,
      detail: project.owner,
      pick: () => emit('edit', { kind: 'addToProject', project }),
    }));
}

/** The arrangement the header's button and `⇧Enter` move the item to. */
interface OtherArrangement {
  readonly arrangement: ItemArrangement;
  readonly title: string;
  readonly icon: LucideIcon;
}
</script>

<template>
  <article
    :class="[css.itemView, css[`itemView_${arrangement}`]]"
    :aria-label="item.title"
  >
    <header
      :class="css.itemView_toolbar"
      v-bind="WINDOW_DRAG_REGION"
    >
      <Menu
        v-model:open="itemMenuOpen"
        align="start"
      >
        <template #trigger>
          <button
            type="button"
            :class="css.itemView_reference"
            :aria-label="t(l.itemMenuLabel, { reference: `${item.repository.nameWithOwner}#${item.number}` })"
            :aria-keyshortcuts="formatAriaKeyShortcuts(ITEM_KEYS.itemMenu)"
          >
            <component
              :is="state.icon"
              :class="[css.itemView_kind, css[`itemView_kind_${state.tone}`]]"
              aria-hidden="true"
            />
            <span :class="css.itemView_repository">{{ item.repository.nameWithOwner }}</span>
            <span :class="css.itemView_number">#{{ item.number }}</span>
            <ChevronDown
              :class="css.itemView_chevron"
              aria-hidden="true"
            />
          </button>
        </template>
        <CommandMenuSections :sections="itemMenuSections" />
        <MenuSeparator />
        <MenuLabel>
          <span :class="css.itemView_menuFooter">
            {{ t(l.itemMenu) }}
            <MenuShortcut :shortcut="ITEM_KEYS.itemMenu" />
          </span>
        </MenuLabel>
      </Menu>
      <span :class="css.itemView_spacer" />
      <ItemWalkStepper
        v-if="position"
        :position="position"
        :previous-label="t(l.previous)"
        :next-label="t(l.next)"
        @previous="emit('previous')"
        @next="emit('next')"
      />
      <IconButton
        v-if="otherArrangement"
        :icon="otherArrangement.icon"
        :label="otherArrangement.title"
        :kbd="ITEM_KEYS.arrange"
        :keyshortcuts="ITEM_KEYS.arrange"
        @click="emit('arrange', otherArrangement.arrangement)"
      />
      <IconButton
        :icon="Github"
        :label="t(l.openOnGitHub)"
        :kbd="ITEM_KEYS.openOnGitHub"
        :link="item.url"
        target="_blank"
        rel="noopener noreferrer"
        :keyshortcuts="ITEM_KEYS.openOnGitHub"
      />
      <IconButton
        :icon="X"
        :label="t(l.close)"
        kbd="Escape"
        keyshortcuts="Escape"
        @click="emit('close')"
      />
    </header>

    <div
      ref="body"
      :class="css.itemView_body"
    >
      <!-- One column only: in two the stack's map heads the summary, which never scrolls away with the thread. -->
      <StackBar
        v-if="stack && !twoColumns"
        ref="stackBar"
        v-model:dropped="stackDropped"
        :stack="stack"
        :current-id="item.id"
        :rows-in-view="stackRowsInView"
        @open="emit('openInPlace', $event)"
      />
      <ColumnSplit
        :shown="twoColumns"
        :width="SUMMARY_WIDTH"
        :pane-min="TIMELINE_MIN_WIDTH"
        :label="t(l.resizeSummary)"
        seamless
      >
        <template #column>
          <!-- Where the summary goes in two columns. -->
          <div
            ref="summaryColumn"
            :class="css.itemView_summaryColumn"
          />
        </template>
        <div :class="css.itemView_content">
          <div
            v-if="stack && stackDropped && !twoColumns"
            ref="stackDrop"
            :class="css.itemView_stackDrop"
          >
            <StackMap
              :stack="stack"
              :current-id="item.id"
              :neighbours="neighbours"
              arrangement="panel"
              @open="emit('openInPlace', $event)"
            />
          </div>
          <div
            ref="scroll"
            :class="[css.itemView_scroll, twoColumns && css.itemView_scroll_twoColumns]"
            :data-route-scroll="`item-main:${arrangement}:${item.id}`"
            data-suggestions-boundary
            @scroll.passive="onContentScroll"
          >
            <!-- In one column the summary is the content's first block; in two it moves to its column as it is, nothing remounted (an open picker stays open). Not before the column is there to take it. -->
            <Teleport
              :to="summaryColumnRef"
              :disabled="!twoColumns || !summaryColumnRef"
            >
              <div
                :class="[css.itemView_summary, twoColumns && css.itemView_summary_column]"
                :data-route-scroll="`item-summary:${arrangement}:${item.id}`"
              >
                <!-- One column: the rows the bar names. While the copy is dropped over it, out of reach and out of the accessibility tree: one map at a time. -->
                <div
                  v-if="stack && !twoColumns"
                  ref="stackRows"
                  :class="css.itemView_stackRows"
                  :inert="stackDropped"
                  :aria-hidden="stackDropped ? 'true' : undefined"
                >
                  <StackMap
                    :stack="stack"
                    :current-id="item.id"
                    :neighbours="neighbours"
                    arrangement="panel"
                    @open="emit('openInPlace', $event)"
                  />
                </div>
                <!-- Two columns: no bar to name the stack, so the map names it itself. -->
                <div
                  v-if="stack && twoColumns"
                  :class="css.itemView_stackMap"
                >
                  <StackMap
                    :stack="stack"
                    :current-id="item.id"
                    :neighbours="neighbours"
                    arrangement="page"
                    @open="emit('openInPlace', $event)"
                  />
                </div>
                <div :class="css.itemView_heading">
                  <h1 :class="css.itemView_title">{{ item.title }}</h1>
                  <p :class="css.itemView_state">
                    <StatePill
                      :icon="state.icon"
                      :tone="state.tone"
                      >{{ state.text }}</StatePill
                    >
                    <LabelPill
                      v-if="issueType"
                      :name="issueType.name"
                      :color="getGitHubColor(issueType.color)"
                    />
                    <Avatar
                      v-if="opened.author"
                      :name="opened.author.login"
                      :src="opened.author.avatarUrl"
                      size="xs"
                      decorative
                    />
                    <span :class="css.itemView_opened">{{ opened.text }}</span>
                  </p>
                </div>

                <template v-if="pr">
                  <PullRequestMerge
                    :pr="pr"
                    :detail="prDetail"
                    :can-merge="permissions ? permissions.mergePanel : null"
                    :checks="checkCounts"
                    :auto-merge-allowed="autoMergeAllowed"
                    :record="merging?.getRecord(pr.id) ?? null"
                    :commands="merging?.getCommands(pr.id)"
                    @merge="emit('merge')"
                    @command="merging?.run(pr.id, $event)"
                  />
                  <PullRequestReviews
                    v-if="prDetail"
                    ref="reviews"
                    :detail="prDetail"
                    :now="now"
                    :reviewer-options="reviewerOptions"
                    @request="emit('edit', { kind: 'requestReviewers', logins: $event })"
                  />
                  <PullRequestChecks
                    v-if="prDetail"
                    :detail="prDetail"
                    :now="now"
                    :required-ids="requiredCheckIds"
                  />
                  <LinkedItems
                    :title="t(l.closes)"
                    :items="closes ?? []"
                    :repository="item.repository.nameWithOwner"
                    @open="emit('open', $event)"
                  />
                </template>
                <ItemProperties
                  ref="properties"
                  :item="item"
                  :detail="issueDetail"
                  :editing="editing"
                  @open="emit('open', $event)"
                  @edit="emit('edit', $event)"
                />
                <ItemProjects
                  ref="projects"
                  :projects="item.projects"
                  :detail-projects="detail?.projects"
                  :now="now"
                  :editable="editing != null"
                  :can-add-to-project="permissions?.addToProject"
                  :viewer-projects="editing?.viewerProjects"
                  @edit="emit('edit', $event)"
                  @need-projects="emit('needProjects')"
                />
              </div>
            </Teleport>

            <div
              :class="css.itemView_timeline"
              :data-route-scroll="`item-timeline:${arrangement}:${item.id}`"
            >
              <ItemThread
                ref="thread"
                :class="css.itemView_thread"
                :item="item"
                :detail="detail"
                :now="now"
                :load-middle="loadThreadMiddle"
                :failed="detailFailed"
                :read-again="readDetailAgain"
                :linked-anchor="linkedAnchor"
                :failed-comments="failedComments"
                :viewer="viewer"
                :can-retry="editing != null && canComment"
                :can-quote="canComment"
                :failed-edits="failedEdits"
                :people="threadPeople"
                :review-threads="reviewThreads"
                :review-threads-loading="reviewThreadsLoading"
                :review-writing="reviewWriting"
                :review-draft-first="reviewDraftFirst"
                :looked-at="lookedAt"
                :opened-at="openedAt"
                @retry="emit('retryComment', $event)"
                @discard="emit('discardComment', $event)"
                @edit="emit('edit', $event)"
                @discard-edit="emit('discardEdit', $event)"
                @quote-reply="quoteReply"
                @open="emit('open', $event)"
              >
                <template #composer>
                  <ItemThreadComposer
                    ref="composer"
                    v-model:text="commentDraft"
                    :item="item"
                    :viewer="viewer"
                    :can-comment="canComment"
                    :can-close="permissions?.state === true"
                    :read-only="readOnly"
                    :people="threadPeople"
                    @edit="edit"
                  />
                </template>
              </ItemThread>
            </div>
          </div>
        </div>
      </ColumnSplit>
    </div>
  </article>
</template>

<style lang="scss" module="css">
// A page in one column keeps its content to the reading width, centred: 40px from the edges, more once it is wider.
$item-page-inset: max(40px, calc((100% - #{$item-reading-width}) / 2));
// Two columns: each column's content this far from its edges, so the invisible edge between them lies midway.
$item-column-inset: 32px;

.itemView {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: $color-fg;
  background: $color-bg-item;
}

.itemView_toolbar {
  @include list-header;

  padding: 0 14px 0 $spacing-16;
  font-size: $font-size-sm;
}

.itemView_reference {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  min-width: 0;
  height: 26px;
  padding: 0 $spacing-6;
  margin-left: -$spacing-6;
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: $radius-md;

  &:hover,
  &[data-state='open'] {
    background: $color-bg-3;
  }
}

.itemView_chevron {
  flex: none;
  width: 12px;
  height: 12px;
  margin-left: -$spacing-4;
  color: $color-fg-dim;
}

.itemView_menuFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.itemView_kind {
  flex: none;
  width: 14px;
  height: 14px;

  @include item-kind-tones;
}

.itemView_repository {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-2;
  white-space: nowrap;
}

.itemView_number {
  flex: none;
  font-family: $font-family-mono;
  color: $color-fg-dim;
}

.itemView_spacer {
  flex: 1;
}

// Its width decides the layout (`twoColumns`): the stack bar and the content in one column, the summary's column and
// the timeline in two.
.itemView_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

// Two columns: the summary's column, the summary scrolling in it, on the view's own surface.
.itemView_summaryColumn {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

// The content and, in one column, what drops over it from the stack bar.
.itemView_content {
  position: relative;
  // The dropped rows slide out from under the bar: what is still above the content is cut off, never over the bar.
  overflow: clip;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

// The stack's rows, the content's first block (D25): as wide as the panel, the edge under them across it.
.itemView_stackRows {
  margin: -20px (-$spacing-24) 0;
  border-bottom: 1px solid $color-border;

  // A page's inset is no fixed width to run past: the rows keep to the column.
  .itemView_page & {
    margin: -$spacing-16 0 0;
  }
}

// Two columns only: the map heading the summary, the edge under it.
.itemView_stackMap {
  padding-bottom: $spacing-16;
  border-bottom: 1px solid $color-border;
}

// D27, SP84: the same rows dropped right under the bar, over the content, which doesn't move.
.itemView_stackDrop {
  position: absolute;
  inset: 0 0 auto;
  z-index: 2;
  max-height: 100%;
  overflow-y: auto;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;

  // D38: it slides out from under the bar; it goes at once, like every overlay.
  @include motion {
    animation: stackDrop $motion-open ease-out;
  }
}

@keyframes stackDrop {
  from {
    translate: 0 -100%;
  }
}

// One column: the summary, then the thread, scrolling together.
.itemView_scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  padding: 20px $spacing-24;
  overflow-y: auto;
  // What is brought into view (a linked comment, a code thread by `J`/`K`, the composer by `R`) keeps the space the
  // ends of the scroll leave, not flush against the edge.
  scroll-padding-block: 20px;

  // At most the reading width, centred.
  .itemView_page & {
    padding: 32px $item-page-inset;
    scroll-padding-block: 32px;
  }

  // Sections keep their height; the column scrolls instead.
  > * {
    flex: none;
  }
}

// Two columns: only the timeline is left here, scrolling on its own, at most the reading width at the left (F18–F20,
// F23), as far from the edge as the summary is; what is left of the width stays empty at the right.
.itemView_scroll_twoColumns,
.itemView_page .itemView_scroll_twoColumns {
  gap: 0;
  padding: 0;
  overflow: hidden;

  > .itemView_timeline {
    flex: 1;
    min-height: 0;
    padding: $item-column-inset;
    overflow-y: auto;
    scroll-padding-block: $item-column-inset;
  }

  .itemView_thread {
    max-width: $item-reading-width;
  }
}

// The stack, the heading, where a pull request stands, its reviews and checks, what it closes, the properties and
// projects.
.itemView_summary {
  display: flex;
  flex-direction: column;
  gap: 20px;

  > * {
    flex: none;
  }
}

// Two columns: the summary pinned in its column, scrolling only when taller than the view.
.itemView_summary_column {
  flex: 1;
  min-height: 0;
  padding: $item-column-inset;
  overflow-y: auto;
  scroll-padding-block: $item-column-inset;
}

.itemView_heading {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
}

.itemView_title {
  font-size: 20px;
  font-weight: $font-weight-semibold;
  line-height: 26px;
}

.itemView_state {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-10;
  align-items: center;
}

.itemView_opened {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
