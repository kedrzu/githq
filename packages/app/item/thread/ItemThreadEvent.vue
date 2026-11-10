<!-- One line of events on an item's thread (`Activity / Event`, item-activity F13): a badge on the rail with the first event's icon, then who — their avatar and login — and what they did, each part joined with "and" (labels as the lists' chips, issues, pull requests and commits as links in accent), wrapping under itself, and the time of the newest at the right. An item links to where the app opens it (a plain click opens it there, one with a modifier is the browser's); a commit, to GitHub in a new tab. A line no person made shows no avatar: a project workflow's Status change names no one, a pull request's failed checks name "CI" where a person's login would be (F5, F13). -->
<script lang="ts" setup>
import type { TranslationResult, TranslationSimple, TranslationWithParams } from '@nzyme/i18n-core';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useLanguage } from '@nzyme/vue-i18n/useLanguage.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowRightLeft,
  CircleCheck,
  CircleDot,
  CircleSlash,
  CircleX,
  Copy,
  CornerLeftUp,
  Eye,
  EyeOff,
  GitBranch,
  GitCommitHorizontal,
  GitCompareArrows,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Link,
  ListTree,
  Lock,
  LockOpen,
  Milestone,
  Pencil,
  Pin,
  PinOff,
  Shapes,
  Table,
  Tag,
  UserMinus,
  UserPlus,
} from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed, Fragment, h, isVNode, useCssModule } from 'vue';
import type { VNodeChild } from 'vue';

import Avatar from '@/components/Avatar.vue';
import LabelPill from '@/components/LabelPill.vue';
import { getReviewRequestName } from '@/store/getReviewRequestName.js';
import type { ThreadCommitRef, ThreadReferencedCommit, ThreadRef } from '@/store/ItemDetailTypes.js';
import type { Item, ItemUser } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';
import { formatList } from '@/utils/formatList.js';
import { formatRelativeReference } from '@/utils/formatRelativeReference.js';
import { joinList } from '@/utils/joinList.js';

import { getItemPagePath, parseItemUrl } from '../itemRoutes.js';
import type { ItemReference } from '../itemRoutes.js';
import type {
  SingleThreadEvent,
  ThreadChecksFailed,
  ThreadEventLine,
  ThreadEventPart,
  ThreadMergedPart,
} from './buildThread.js';
import * as l from './ItemThreadEvent.loc.js';

const props = defineProps<{
  entry: ThreadEventLine | ThreadChecksFailed;
  /** The item whose thread it is: an issue or a pull request of its repository is named by its number alone. */
  item: Item;
  /** Epoch ms the age is counted to. */
  now: number;
}>();

const emit = defineEmits<{
  /** A plain click on an issue or a pull request it names. */
  open: [reference: ItemReference];
}>();

/** The badge's icon, in a colour when the event changed the item's state (F13). */
interface EventLook {
  readonly icon: LucideIcon;
  readonly tone: 'muted' | 'green' | 'red' | 'purple';
}

const t = useTranslate();
const language = useLanguage();
const css = useCssModule('css');

const actor = computed(() => (props.entry.kind === 'events' ? props.entry.actor : null));
const look = computed((): EventLook => {
  const { entry } = props;
  if (entry.kind === 'checksFailed') {
    return { icon: CircleX, tone: 'red' };
  }

  const [first] = entry.parts;
  return first ? getPartLook(first) : { icon: GitCommitHorizontal, tone: 'muted' };
});
const when = computed(() => formatAge(Date.parse(props.entry.updatedAt), props.now));

/** What was done, each part joined with "and". */
function What() {
  const { entry } = props;
  if (entry.kind === 'checksFailed') {
    return sayWith(l.checksFailed, {
      failed: entry.failedCount,
      total: entry.total,
      commit: renderCommit(entry.commit),
      names: entry.failed.join(', '),
    });
  }

  return entry.parts.flatMap((part, index) => [
    ...(index > 0 ? [' ', t(l.and), ' '] : []),
    ...renderPart(part, index > 0),
  ]);
}

function renderPart(part: ThreadEventPart, after: boolean): VNodeChild[] {
  switch (part.kind) {
    case 'labeled':
    case 'unlabeled':
      return sayWith(l[part.kind], {
        labels: h(
          'span',
          { class: css.itemThreadEvent_labels },
          part.objects.map(label => h(LabelPill, { name: label.name, color: label.color })),
        ),
      });
    case 'assigned':
    case 'unassigned': {
      const login = actor.value?.login;
      if (part.objects.length === 1 && login !== undefined && part.objects[0]?.login === login) {
        return say(part.kind === 'assigned' ? l.selfAssigned : l.selfUnassigned);
      }

      return sayWith(l[part.kind], { users: formatList(part.objects.map(getLogin)) });
    }
    case 'reviewRequested':
    case 'reviewRequestedAgain':
    case 'reviewRequestRemoved': {
      const [only] = part.objects;
      if (only?.kind === 'user' && part.objects.length === 1 && only.user.login === actor.value?.login) {
        return say(l[`${part.kind}Self`]);
      }

      return sayWith(l[part.kind], { reviewers: formatList(part.objects.map(getReviewRequestName)) });
    }
    case 'crossReferenced':
    case 'subIssueAdded':
    case 'subIssueRemoved':
      return renderRefs(part);
    case 'referenced':
      return renderReferenced(part);
    case 'single':
      return renderEvent(part.event, after);
    default:
      return assertNever(part);
  }
}

/** Issues or pull requests of one kind of event: one with its title, more by their numbers alone (F13). */
function renderRefs(
  part: ThreadMergedPart<'crossReferenced' | 'subIssueAdded' | 'subIssueRemoved', ThreadRef>,
): VNodeChild[] {
  const [only] = part.objects;
  if (only && part.objects.length === 1) {
    return sayWith(l[part.kind], { ref: renderRef(only), title: only.title });
  }

  const refs = h(Fragment, joinList(part.objects.map(renderRef)));
  switch (part.kind) {
    case 'crossReferenced':
      return sayWith(l.crossReferencedMany, { refs });
    case 'subIssueAdded':
      return sayWith(l.subIssuesAdded, { refs });
    case 'subIssueRemoved':
      return sayWith(l.subIssuesRemoved, { refs });
    default:
      return assertNever(part.kind);
  }
}

/** The commits that referenced this: one with its message, more by their hashes alone (F13). */
function renderReferenced(part: ThreadMergedPart<'referenced', ThreadReferencedCommit>): VNodeChild[] {
  const [only] = part.objects;
  if (only && part.objects.length === 1) {
    return sayWith(l.referenced, { commit: renderCommit(only), title: only.messageHeadline });
  }

  return sayWith(l.referencedMany, { commits: h(Fragment, joinList(part.objects.map(renderCommit))) });
}

/** One event's words; `after` another part of the line, a locked conversation is "the" one. */
function renderEvent(event: SingleThreadEvent, after: boolean): VNodeChild[] {
  switch (event.kind) {
    case 'forcePushed': {
      const branch = props.item.kind === 'pullRequest' ? props.item.headRefName : '';
      return event.beforeOid !== null && event.afterOid !== null
        ? sayWith(l.forcePushed, { branch, before: event.beforeOid, after: event.afterOid })
        : sayWith(l.forcePushedBranch, { branch });
    }
    case 'renamed':
      return sayWith(l.renamed, { from: event.from, to: event.to });
    case 'milestoned':
    case 'demilestoned':
      return sayWith(l[event.kind], { milestone: event.milestone });
    case 'reviewDismissed': {
      const reviewer = getLogin(event.reviewer);
      return event.message
        ? sayWith(l.reviewDismissedWithMessage, { reviewer, message: event.message })
        : sayWith(l.reviewDismissed, { reviewer });
    }
    case 'readyForReview':
    case 'convertedToDraft':
    case 'reopened':
    case 'unlocked':
    case 'pinned':
    case 'unpinned':
      return say(l[event.kind]);
    case 'baseChanged':
      return sayWith(l.baseChanged, { from: event.from, to: event.to });
    case 'closed':
      return renderClosed(event);
    case 'merged':
      return event.commit
        ? sayWith(l.merged, { commit: renderCommit(event.commit), branch: event.into })
        : sayWith(l.mergedNoCommit, { branch: event.into });
    case 'headRefDeleted':
      return sayWith(l.headRefDeleted, { branch: event.branch });
    // Only an issue's thread has them (F13): what was linked is a pull request.
    case 'connected':
      return sayWith(l.connectedPullRequest, { ref: renderRef(event.ref) });
    case 'disconnected':
      return sayWith(l.disconnectedPullRequest, { ref: renderRef(event.ref) });
    // Apart from the merged ones only when the viewer cannot see what they were of (`buildThread`).
    case 'referenced':
      return sayWith(l.referencedHidden, { repository: event.repository });
    case 'subIssueAdded':
      return say(l.subIssueAddedHidden);
    case 'subIssueRemoved':
      return say(l.subIssueRemovedHidden);
    case 'parentAdded':
      return event.issue
        ? sayWith(l.parentAdded, { ref: renderRef(event.issue), title: event.issue.title })
        : say(l.parentAddedHidden);
    case 'parentRemoved':
      return event.issue
        ? sayWith(l.parentRemoved, { ref: renderRef(event.issue), title: event.issue.title })
        : say(l.parentRemovedHidden);
    case 'issueTypeChanged':
      if (event.from && event.to) {
        return sayWith(l.issueTypeChanged, { from: event.from.name, to: event.to.name });
      }

      return event.to
        ? sayWith(l.issueTypeSet, { to: event.to.name })
        : sayWith(l.issueTypeRemoved, { from: event.from?.name ?? '' });
    case 'addedToProject':
    case 'removedFromProject':
      return sayWith(l[event.kind], { project: event.project?.title ?? t(l.hiddenProject) });
    case 'projectStatusChanged': {
      const project = event.project?.title ?? t(l.hiddenProject);
      if (event.wasAutomated) {
        return event.to
          ? sayWith(l.projectStatusAutomated, { status: event.to, project })
          : sayWith(l.projectStatusClearedAutomated, { project });
      }

      return event.to
        ? sayWith(l.projectStatusChanged, { status: event.to, project })
        : sayWith(l.projectStatusCleared, { project });
    }
    case 'transferred':
      return event.from ? sayWith(l.transferred, { repository: event.from }) : say(l.transferredHidden);
    case 'locked':
      if (event.reason) {
        return sayWith(after ? l.lockedAsAfter : l.lockedAs, { reason: t(l[event.reason]) });
      }

      return say(after ? l.lockedAfter : l.locked);
    default:
      return assertNever(event);
  }
}

function renderClosed(event: Extract<SingleThreadEvent, { readonly kind: 'closed' }>): VNodeChild[] {
  if (props.item.kind === 'pullRequest') {
    return say(l.closed);
  }

  const { closer } = event;
  switch (event.stateReason) {
    case 'NOT_PLANNED':
      return say(l.closedNotPlanned);
    case 'DUPLICATE':
      // GitHub need not name the other (github/roadmap#1318): a duplicate all the same.
      return event.duplicateOf
        ? sayWith(l.closedDuplicate, { ref: renderRef(event.duplicateOf) })
        : say(l.closedAsDuplicate);
    case 'COMPLETED':
    case 'REOPENED':
    case null:
      if (closer) {
        const ref = closer.kind === 'pullRequest' ? renderRef(closer.pullRequest) : renderCommit(closer);
        return sayWith(l.closedCompletedIn, { ref });
      }

      return say(l.closedCompleted);
    default:
      return assertNever(event.stateReason);
  }
}

/** A translation's words. */
function say(translation: TranslationSimple): VNodeChild[] {
  return toChildren(translation(language.value));
}

/** A translation with its parameters in place, which may be elements. */
function sayWith<TParams>(translation: TranslationWithParams<TParams>, params: TParams): VNodeChild[] {
  return toChildren(translation(language.value, params));
}

function toChildren(result: TranslationResult): VNodeChild[] {
  if (typeof result === 'string') {
    return [result];
  }

  if (!Array.isArray(result)) {
    return [];
  }

  return result.map((part: unknown) => (isVNode(part) || typeof part === 'string' ? part : String(part)));
}

/** An issue or a pull request, by its number — with its repository when it is another's. */
function renderRef(ref: ThreadRef) {
  const reference = parseItemUrl(ref.url);
  return h(
    'a',
    {
      class: css.itemThreadEvent_ref,
      href: reference ? getItemPagePath(reference, ref.kind) : ref.url,
      onClick: (event: MouseEvent) => openRef(event, reference),
    },
    formatRelativeReference(ref, props.item.repository.nameWithOwner),
  );
}

function renderCommit(commit: ThreadCommitRef) {
  return h(
    'a',
    { class: css.itemThreadEvent_ref, href: commit.url, target: '_blank', rel: 'noopener noreferrer' },
    commit.abbreviatedOid,
  );
}

function openRef(event: MouseEvent, reference: ItemReference | null) {
  if (!reference || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  emit('open', reference);
}

function getLogin(user: ItemUser | null) {
  return user?.login ?? t(l.deletedUser);
}

function getPartLook(part: ThreadEventPart): EventLook {
  switch (part.kind) {
    case 'labeled':
    case 'unlabeled':
      return { icon: Tag, tone: 'muted' };
    case 'assigned':
      return { icon: UserPlus, tone: 'muted' };
    case 'unassigned':
      return { icon: UserMinus, tone: 'muted' };
    case 'reviewRequested':
    case 'reviewRequestedAgain':
      return { icon: Eye, tone: 'muted' };
    case 'reviewRequestRemoved':
      return { icon: EyeOff, tone: 'muted' };
    case 'crossReferenced':
      return { icon: Link, tone: 'muted' };
    case 'subIssueAdded':
    case 'subIssueRemoved':
      return { icon: ListTree, tone: 'muted' };
    case 'referenced':
      return { icon: GitCommitHorizontal, tone: 'muted' };
    case 'single':
      return getEventLook(part.event);
    default:
      return assertNever(part);
  }
}

function getEventLook(event: SingleThreadEvent): EventLook {
  const pullRequest = props.item.kind === 'pullRequest';
  switch (event.kind) {
    case 'forcePushed':
      return { icon: GitCompareArrows, tone: 'muted' };
    case 'renamed':
      return { icon: Pencil, tone: 'muted' };
    case 'milestoned':
    case 'demilestoned':
      return { icon: Milestone, tone: 'muted' };
    case 'reviewDismissed':
      return { icon: CircleX, tone: 'muted' };
    case 'readyForReview':
      return { icon: GitPullRequest, tone: 'green' };
    case 'convertedToDraft':
      return { icon: GitPullRequestDraft, tone: 'muted' };
    case 'baseChanged':
    case 'headRefDeleted':
      return { icon: GitBranch, tone: 'muted' };
    case 'closed':
      if (pullRequest) {
        return { icon: GitPullRequestClosed, tone: 'red' };
      }

      if (event.stateReason === 'NOT_PLANNED') {
        return { icon: CircleSlash, tone: 'muted' };
      }

      return event.stateReason === 'DUPLICATE' ? { icon: Copy, tone: 'muted' } : { icon: CircleCheck, tone: 'purple' };
    case 'reopened':
      return pullRequest ? { icon: GitPullRequest, tone: 'green' } : { icon: CircleDot, tone: 'green' };
    case 'merged':
      return { icon: GitMerge, tone: 'purple' };
    case 'connected':
      return { icon: GitPullRequest, tone: 'green' };
    case 'disconnected':
      return { icon: GitPullRequest, tone: 'muted' };
    case 'referenced':
      return { icon: GitCommitHorizontal, tone: 'muted' };
    case 'subIssueAdded':
    case 'subIssueRemoved':
      return { icon: ListTree, tone: 'muted' };
    case 'parentAdded':
    case 'parentRemoved':
      return { icon: CornerLeftUp, tone: 'muted' };
    case 'issueTypeChanged':
      return { icon: Shapes, tone: 'muted' };
    case 'addedToProject':
    case 'removedFromProject':
    case 'projectStatusChanged':
      return { icon: Table, tone: 'muted' };
    case 'transferred':
      return { icon: ArrowRightLeft, tone: 'muted' };
    case 'locked':
      return { icon: Lock, tone: 'muted' };
    case 'unlocked':
      return { icon: LockOpen, tone: 'muted' };
    case 'pinned':
      return { icon: Pin, tone: 'muted' };
    case 'unpinned':
      return { icon: PinOff, tone: 'muted' };
    default:
      return assertNever(event);
  }
}
</script>

<template>
  <div :class="css.itemThreadEvent">
    <span
      :class="css.itemThreadEvent_badge"
      aria-hidden="true"
    >
      <component
        :is="look.icon"
        :class="[css.itemThreadEvent_icon, css[`itemThreadEvent_icon_${look.tone}`]]"
      />
    </span>
    <p :class="css.itemThreadEvent_line">
      <template v-if="actor">
        <Avatar
          :class="css.itemThreadEvent_avatar"
          :name="actor.login"
          :src="actor.avatarUrl"
          decorative
        />
        <span :class="css.itemThreadEvent_who">{{ actor.login }}</span>
      </template>
      <span
        v-else-if="entry.kind === 'checksFailed'"
        :class="css.itemThreadEvent_who"
        >{{ t(l.ci) }}</span
      >
      <span :class="css.itemThreadEvent_what"><What /></span>
      <time
        :class="css.itemThreadEvent_when"
        :datetime="entry.updatedAt"
        >{{ when }}</time
      >
    </p>
  </div>
</template>

<style lang="scss" module="css">
.itemThreadEvent {
  @include item-thread-badge-row;
}

.itemThreadEvent_badge {
  @include item-thread-badge;
}

.itemThreadEvent_icon {
  width: 14px;
  height: 14px;
}

.itemThreadEvent_icon_muted {
  color: $color-fg-2;
}

.itemThreadEvent_icon_green {
  color: $color-green;
}

.itemThreadEvent_icon_red {
  color: $color-red;
}

.itemThreadEvent_icon_purple {
  color: $color-purple;
}

// Level with the badge's centre on the first line; what was done wraps under itself.
.itemThreadEvent_line {
  display: flex;
  flex: 1;
  gap: $spacing-6;
  align-items: flex-start;
  min-width: 0;
  padding-top: $spacing-4;
  margin: 0;
  font-size: $font-size-sm;
  line-height: 1.45;
}

.itemThreadEvent_avatar {
  flex: none;
}

.itemThreadEvent_who {
  flex: none;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.itemThreadEvent_what {
  flex: 1;
  min-width: 0;
  color: $color-fg-2;
  overflow-wrap: anywhere;
}

.itemThreadEvent_labels {
  display: inline-flex;
  flex-wrap: wrap;
  gap: $spacing-4;
  vertical-align: bottom;
}

.itemThreadEvent_ref {
  @include focus-ring;

  font-weight: $font-weight-medium;
  color: $color-accent;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.itemThreadEvent_when {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}
</style>
