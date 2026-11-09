<!-- An opened issue or pull request (D9): the same view in a panel beside the list, a modal over it or a page of its own. The header names the item and holds the way through the list (`K`/`J`, "3 / 13"), the arrangement switch, GitHub (`O`) and close (`Esc`); its reference (`skyline-labs/portal #1187 ▾`) opens the item menu (M1–M2, also `⌘.`): every action the user may take on the item, grouped as a list's context menu groups them, each with its key. A panel stacks everything in one column; a modal and a page give the properties, projects and reviewers a column at the side. A pull request leads with where it stands (`PullRequestMerge`), its reviews and checks. A pull request in a stack shows the stack's map (`StackMap`, stacked PRs D25, D27): in a panel the stack bar (`StackBar`) is pinned above the content and the map's rows are the content's first block, scrolling away under the bar like the rest — nothing above the content ever changes height; once they are out of view a click on the bar drops a copy of them over the content, sliding out of the bar (D38), closed by Escape, a click outside, any scroll of the content, opening a pull request or the rows coming back into view; every pull request of the stack opens at the top, its rows in view; at the top of the side column in a modal; a column of its own on a page's left, the main column giving up its width. The thread ends in the composer (`ItemThreadComposer`), scrolling with the rest — nothing is pinned to the bottom: `R` brings it into view and puts the cursor in it (⌘↵ posts); for a pull request `D` opens its review and `⇧O` its changed files on GitHub. With `editing`, what the user may change is changed here (M3): `A`, `L`, `M` open the pickers of assignees, labels and milestone, `S`, `P`, `I` those of the first project's status, priority and iteration, `⇧R` asks for reviews, `⇧M` opens the merge panel for a pull request the user may merge (merging D9), `T` the issue type's, and `⇧X` closes or reopens it as the composer's button does — an issue as completed, not planned being in the button's menu and the item menu. What the user may not change is shown but not offered (K1b). -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { useIntersectionObserver } from '@nzyme/vue-utils/useIntersectionObserver.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
  AppWindow,
  CircleCheck,
  CircleCheckBig,
  CircleDot,
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
  PanelRight,
  X,
} from 'lucide-vue-next';
import { SplitterGroup, SplitterPanel } from 'reka-ui';
import { computed, ref, useTemplateRef, watch } from 'vue';

import CommandMenuSections from '@/commands/CommandMenuSections.vue';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import type { Command, CommandOption } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import { EDIT_KEYS, useEditCommands } from '@/commands/useEditCommands.js';
import type { StateOption } from '@/commands/useEditCommands.js';
import Avatar from '@/components/Avatar.vue';
import IconButton from '@/components/IconButton.vue';
import LabelPill from '@/components/LabelPill.vue';
import Menu from '@/components/Menu.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuSeparator from '@/components/MenuSeparator.vue';
import MenuShortcut from '@/components/MenuShortcut.vue';
import ResizeHandle from '@/components/ResizeHandle.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import StatePill from '@/components/StatePill.vue';
import type { StatePillTone } from '@/components/StatePill.vue';
import { usePanelWidth } from '@/components/usePanelWidth.js';
import type { FailedComment } from '@/edits/CommentDrafts.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { usePickerOptions } from '@/edits/usePickerOptions.js';
import { getPullRequestKind } from '@/lists/utils/getPullRequestKind.js';
import { countMergeChecks } from '@/merge/countMergeChecks.js';
import { isAutoMergeAllowed } from '@/merge/isAutoMergeAllowed.js';
import { MergeContext } from '@/merge/MergeContext.js';
import type { MergeCheck } from '@/merge/MergeTypes.js';
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
import ItemProjects from './ItemProjects.vue';
import ItemProperties from './ItemProperties.vue';
import { formatShortReference, ITEM_ARRANGEMENTS } from './itemRoutes.js';
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
    /** Reads the comments not read yet. */
    loadAllComments: () => Promise<void>;
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
  }>(),
  // Vue reads a boolean prop not given as `false`: not given is not known.
  { viewerCanEnableAutoMerge: null },
);

const emit = defineEmits<{
  close: [];
  previous: [];
  next: [];
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
  /** "Add to project" opened: the projects to offer are wanted. */
  needProjects: [];
  /** "Merge…" (`⇧M`): the merge panel is wanted for the pull request. */
  merge: [];
}>();

const ARRANGEMENT_ICONS: Readonly<Record<ItemArrangement, LucideIcon>> = {
  panel: PanelRight,
  modal: AppWindow,
  page: Maximize2,
};

/** What is typed into the comment box and not posted yet. */
const commentDraft = defineModel<string>('commentDraft', { default: '' });
const t = useTranslate();
const browser = useService(Browser);
/** Merging, where the screen offers it: how the session's last merge of a pull request ended (PM38). */
const merging = injectContext(MergeContext, { optional: true });
const pickerOptions = usePickerOptions();
const editCommands = useEditCommands();
const composerRef = useTemplateRef<InstanceType<typeof ItemThreadComposer>>('composer');
const propertiesRef = useTemplateRef<InstanceType<typeof ItemProperties>>('properties');
const projectsRef = useTemplateRef<InstanceType<typeof ItemProjects>>('projects');
const reviewsRef = useTemplateRef<InstanceType<typeof PullRequestReviews>>('reviews');
const scrollRef = useTemplateRef<HTMLElement>('scroll');
const stackRowsRef = useTemplateRef<HTMLElement>('stackRows');
const stackBarRef = useTemplateRef<InstanceType<typeof StackBar>>('stackBar');
const stackDropRef = useTemplateRef<HTMLElement>('stackDrop');
const itemMenuOpen = ref(false);
/** In a panel, the stack's rows at the top of the content are in view (D27): the bar has nothing to drop. */
const stackRowsInView = ref(true);
/** In a panel, a copy of the stack's rows dropped from the bar over the content (D27, SP84). */
const stackDropped = ref(false);

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

const split = computed(() => props.arrangement !== 'panel');
// The side column's width, resized by dragging its edge: one for the modal, one for the page.
const sideWidths = {
  modal: usePanelWidth({ key: 'itemSide.modal', default: 320, min: 260, max: 560 }),
  page: usePanelWidth({ key: 'itemSide.page', default: 360, min: 260, max: 560 }),
};
const sideWidth = computed(() => (props.arrangement === 'page' ? sideWidths.page : sideWidths.modal));

// `[main, side?]`: the main column's in percent, the side's in pixels.
function onColumnsLayout(sizes: number[]) {
  const side = sizes[1];
  if (side !== undefined) {
    sideWidth.value.current = side;
  }
}
const arrangementOptions = computed((): SegmentedTabsOption<ItemArrangement>[] => [
  { value: 'panel', label: t(l.panel), icon: ARRANGEMENT_ICONS.panel, iconOnly: true },
  { value: 'modal', label: t(l.modal), icon: ARRANGEMENT_ICONS.modal, iconOnly: true },
  { value: 'page', label: t(l.page), icon: ARRANGEMENT_ICONS.page, iconOnly: true },
]);
const arrangementModel = computed({
  get: () => props.arrangement,
  set: (value: ItemArrangement) => emit('arrange', value),
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
  if (item.kind === 'issue') {
    if (item.state === 'OPEN') {
      return { icon: CircleDot, tone: 'open', text: t(l.open) };
    }

    switch (item.stateReason) {
      case 'NOT_PLANNED':
        return { icon: CircleSlash, tone: 'draft', text: t(l.closedNotPlanned) };
      case 'DUPLICATE':
        return { icon: CircleSlash, tone: 'draft', text: t(l.closedDuplicate) };
      default:
        return { icon: CircleCheck, tone: 'done', text: t(l.closedCompleted) };
    }
  }

  const kind = getPullRequestKind(item);
  // Its state in words, by the tone of its icon.
  const key: `${StatePillTone}PullRequest` = `${kind.tone}PullRequest`;
  return { ...kind, text: t(l[key]) };
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
const ITEM_KEYS = { openOnGitHub: 'O', openFiles: 'Shift+O', review: 'D', itemMenu: 'Mod+.' } as const;

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
    edit: request => emit('edit', request),
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
        emit('edit', { kind: 'close', reason: 'COMPLETED' });
        return true;
      },
      status: () => projectsRef.value?.openByRole('status') ?? false,
      priority: () => projectsRef.value?.openByRole('priority') ?? false,
      iteration: () => projectsRef.value?.openByRole('iteration') ?? false,
    },
  });
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
    ...ITEM_ARRANGEMENTS.filter(arrangement => arrangement !== props.arrangement).map((arrangement): Command => ({
      id: `item.arrange.${arrangement}`,
      title: getArrangementTitle(arrangement),
      section: 'item',
      icon: ARRANGEMENT_ICONS[arrangement],
      run: () => emit('arrange', arrangement),
    })),
  );
  return commands;
}

function getArrangementTitle(arrangement: ItemArrangement) {
  switch (arrangement) {
    case 'panel':
      return t(l.openAsPanel);
    case 'modal':
      return t(l.openAsModal);
    case 'page':
      return t(l.openAsPage);
    default:
      return assertNever(arrangement);
  }
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
      <SegmentedTabs
        v-model="arrangementModel"
        variant="boxed"
        :label="t(l.arrangement)"
        :options="arrangementOptions"
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

    <div :class="css.itemView_body">
      <StackMap
        v-if="stack && arrangement === 'page'"
        :stack="stack"
        :current-id="item.id"
        :neighbours="neighbours"
        arrangement="page"
        @open="emit('openInPlace', $event)"
      />
      <SplitterGroup
        direction="horizontal"
        :class="css.itemView_columns"
        @layout="onColumnsLayout"
      >
        <SplitterPanel
          id="item-main"
          :order="0"
          :min-size="40"
          :class="css.itemView_main"
        >
          <StackBar
            v-if="stack && arrangement === 'panel'"
            ref="stackBar"
            v-model:dropped="stackDropped"
            :stack="stack"
            :current-id="item.id"
            :rows-in-view="stackRowsInView"
            @open="emit('openInPlace', $event)"
          />
          <div :class="css.itemView_content">
            <div
              v-if="stack && arrangement === 'panel' && stackDropped"
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
              :class="css.itemView_scroll"
              :data-route-scroll="`item-main:${item.id}`"
              @scroll.passive="onContentScroll"
            >
              <!-- While the copy is dropped over it, out of reach and out of the accessibility tree: one map at a time. -->
              <div
                v-if="stack && arrangement === 'panel'"
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

              <PullRequestMerge
                v-if="pr"
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

              <!-- One column: everything in reading order. -->
              <template v-if="!split">
                <template v-if="pr">
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
              </template>
              <template v-else-if="pr">
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

              <ItemThread
                :item="item"
                :detail="detail"
                :now="now"
                :load-all="loadAllComments"
                :failed-comments="failedComments"
                :viewer="viewer"
                :can-retry="editing != null && canComment"
                @retry="emit('retryComment', $event)"
                @discard="emit('discardComment', $event)"
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
                    @edit="emit('edit', $event)"
                  />
                </template>
              </ItemThread>
            </div>
          </div>
        </SplitterPanel>

        <template v-if="split">
          <ResizeHandle
            :label="t(l.resizeSide)"
            @resized="sideWidth.save()"
          />
          <SplitterPanel
            id="item-side"
            :key="arrangement"
            as="aside"
            :order="1"
            size-unit="px"
            :default-size="sideWidth.stored"
            :min-size="sideWidth.min"
            :max-size="sideWidth.max"
            :style="sideWidth.style"
          >
            <div
              :class="css.itemView_side"
              :data-route-scroll="`item-side:${item.id}`"
            >
              <StackMap
                v-if="stack && arrangement === 'modal'"
                :stack="stack"
                :current-id="item.id"
                :neighbours="neighbours"
                arrangement="modal"
                @open="emit('openInPlace', $event)"
              />
              <PullRequestReviews
                v-if="prDetail"
                ref="reviews"
                :detail="prDetail"
                :now="now"
                :reviewer-options="reviewerOptions"
                @request="emit('edit', { kind: 'requestReviewers', logins: $event })"
              />
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
          </SplitterPanel>
        </template>
      </SplitterGroup>
    </div>
  </article>
</template>

<style lang="scss" module="css">
// A page's main column keeps its content to the reading width, centred: 40px from the edges, more once it is wider.
$item-page-inset: max(40px, calc((100% - #{$item-reading-width}) / 2));

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
}

.itemView_kind_open {
  color: $color-green;
}

.itemView_kind_done {
  color: $color-purple;
}

.itemView_kind_closed {
  color: $color-red;
}

.itemView_kind_draft {
  color: $color-fg-dim;
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

.itemView_body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.itemView_columns {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.itemView_main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

// The content and, in a panel, what drops over it from the stack bar.
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

.itemView_scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  padding: 20px $spacing-24;
  overflow-y: auto;

  .itemView_modal & {
    padding: 32px 40px;
  }

  // At most the reading width, centred.
  .itemView_page & {
    padding: 32px $item-page-inset;
  }

  // Sections keep their height; the column scrolls instead.
  > * {
    flex: none;
  }
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

.itemView_side {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  padding: 28px $spacing-24;
  overflow-y: auto;
  border-left: 1px solid $color-border;

  > * {
    flex: none;
  }
}
</style>
