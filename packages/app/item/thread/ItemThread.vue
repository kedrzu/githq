<!-- An opened item's whole history as one thread on a rail, oldest first (`buildThread`): the description as its first card, then every comment and event read so far by time — one person's events within minutes on one line (`ItemThreadEvent`), a push with its commits (`ItemThreadPush`), a pull request's failed checks, its reviews with the threads they started (`ItemThreadReview`) and comments on the code posted alone (`ItemThreadCodeComment`) — the threads code review's own, read and written as there — and the viewer's draft review last, with code review's toolbar to finish it (`ItemThreadPendingReview`) — then the composer, there while the rest is read too. Where what others did since the viewer last looked at the item starts, a line says how many there are (`ItemThreadNewSince`, F5), before the same item until another item opens, whatever the viewer posts meanwhile; the fold never hides that item. A long middle folds to one band (`buildThread`, F5): clicking it reads what GitHub has and the detail does not hold, and shows it all in place, the focus on the first revealed item; one the user must see — their comment on its way or not taken, an edit of theirs open or in flight — is never folded away. Before any of the thread is on this device — the description comes with it — no card stands: the rail says what is being read with a skeleton whose first card stands for the description, and once GitHub did not give it, why, with Try again and Open on GitHub (`ItemThreadMissing`, F16). Every text is GitHub's own rendering (`GitHubHtml`); the user's own comment on its way shows at once as the text typed, after everything GitHub told — GitHub renders it once it has it. A comment GitHub did not take stays after it, as typed, with why and Discard and Retry (Retry only while the user may comment) — until it is posted or discarded. Each card's menu (⋯ or a right click, F15) edits it in place (`CommentEditor`) and deletes it — only where GitHub says the user may (K1b) — quotes it into the composer (while the user may comment) or copies its link; an edit GitHub did not take opens again with its text and why. An edit cancelled, or a delete not confirmed, gives the focus back to the card's ⋯. An edit whose text was changed asks before it is let go (`CommentEditor`) — also when the user leaves the item (`askToLeave`). A code thread's "Reply…" opens its reply editor (F10), written through code review's own boxes (`CodeThreadReplies`), so it goes as code review's first key would send it and asks the same question before it is let go; Resolve and Unresolve show at once, the viewer as who resolved it. A code thread takes the focus when clicked, and keeps it — folded to its row or opened — once Resolve, Unresolve, opening it from its row or Hide redraws it: then `J`/`K` move to the next and previous code thread, a folded row among them, and `R` opens its reply editor (F5), instead of stepping through the items and going to the composer. Each comment, review and comment on the code GitHub has carries GitHub's anchor (`issuecomment-<id>`, `pullrequestreview-<id>`, `discussion_r<id>`) as its `id`; the one the address's fragment names is shown — the fold unfolds, the middle read from GitHub first when the detail does not hold all of it, a resolved code thread or a dismissed review opened — and its card's border is in the accent while the address names it, as GitHub marks a linked comment. Bringing it into view is the router's (`shell/routeScroll.ts`), which keeps it there while the thread says it is busy (`aria-busy`): its detail, the middle or a pull request's review threads still being read. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

import CommentDeleteDialog from '@/comments/CommentDeleteDialog.vue';
import CommentEntry from '@/comments/CommentEntry.vue';
import CommentFailedCard from '@/comments/CommentFailedCard.vue';
import { useCommentActions } from '@/comments/useCommentActions.js';
import type { FailedComment, FailedTextEdit } from '@/edits/CommentDrafts.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import { getCommentWays } from '@/review/writing/getCommentWays.js';
import { getPendingComments } from '@/review/writing/getPendingComments.js';
import { getReplyTarget } from '@/review/writing/getReplyTarget.js';
import type { ReviewCommentTarget, ReviewWriting } from '@/review/writing/ReviewWriting.js';
import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import type { Item, ItemUser } from '@/store/ItemTypes.js';
import { isScreenKey } from '@/utils/isScreenKey.js';

import type { ItemReference } from '../itemRoutes.js';
import { buildThread } from './buildThread.js';
import type { ThreadItem } from './buildThread.js';
import type { CodeThreadReplies, CodeThreadReply, CodeThreadSentReply } from './CodeThreadReplies.js';
import { getUrlAnchor } from './getUrlAnchor.js';
import { holdsAnchor } from './holdsAnchor.js';
import * as l from './ItemThread.loc.js';
import ItemThreadCodeComment from './ItemThreadCodeComment.vue';
import ItemThreadEvent from './ItemThreadEvent.vue';
import ItemThreadFold from './ItemThreadFold.vue';
import ItemThreadMissing from './ItemThreadMissing.vue';
import ItemThreadNewSince from './ItemThreadNewSince.vue';
import ItemThreadPendingReview from './ItemThreadPendingReview.vue';
import ItemThreadPush from './ItemThreadPush.vue';
import ItemThreadReview from './ItemThreadReview.vue';

const props = defineProps<{
  item: Item;
  /** `null` while being read. */
  detail: ItemDetail | null;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** Reads the middle of the thread the detail does not hold — events and comments; resolves once all are in. */
  loadMiddle: () => Promise<void>;
  /** None of the thread is on this device and GitHub did not give it: not reached, or refused. */
  failed?: boolean;
  /** Reads the detail again after {@link failed}; resolves once GitHub answered. */
  readAgain?: () => Promise<void>;
  /** The user's comments GitHub did not take, in the order they were written. */
  failedComments?: readonly FailedComment[];
  /** Who wrote them: the user signed in. */
  viewer?: ItemUser | null;
  /** The user may comment: a failed comment can be sent again. */
  canRetry?: boolean;
  /** The composer takes a comment: Quote reply is offered. */
  canQuote?: boolean;
  /** The user's edits of the comments and the description GitHub did not take. */
  failedEdits?: readonly FailedTextEdit[];
  /** The thread's people, whom `@` suggests first in an editor. */
  people?: readonly ItemUser[];
  /** A pull request's review threads, as code review reads them: its reviews and code comments hold them. */
  reviewThreads?: readonly ReviewThread[];
  /** They are being read, none read before: the thread is busy (`aria-busy`) until they are in. */
  reviewThreadsLoading?: boolean;
  /**
   * Code review's writing of the pull request, the same that wrote them: the viewer's draft review finishes there, and
   * replies and resolving go through it.
   */
  reviewWriting?: ReviewWriting | null;
  /** With no draft open, a reply starts one rather than goes at once: code review's setting (D17). */
  reviewDraftFirst?: boolean;
  /** The address's fragment without `#` (`''` for none): the comment it names is shown and marked. */
  linkedAnchor?: string;
  /**
   * When the viewer last looked at the item before opening it (epoch ms, `ItemLookedStore`): a line marks where what
   * others did since starts. `null` when never on this device.
   */
  lookedAt?: number | null;
  /** When the viewer opened the item (epoch ms): what they post after it does not move the line. */
  openedAt?: number | null;
}>();

const emit = defineEmits<{
  /** Send the failed comment again. */
  retry: [id: number];
  /** Drop the failed comment. */
  discard: [id: number];
  /** A comment or the description edited, or a comment deleted. */
  edit: [request: EditRequest];
  /** An edit GitHub did not take was cancelled: of the comment, or (`null`) the description. */
  discardEdit: [commentId: string | null];
  /** Quote reply: the Markdown quoted into the composer. */
  quoteReply: [body: string];
  /** An issue or a pull request an event names was picked. */
  open: [reference: ItemReference];
}>();

defineSlots<{
  /** The thread's last entry, on the rail: the composer. */
  composer?(): unknown;
}>();

/** How GitHub's anchor of an issue or pull request comment starts: one not read yet may be among the older comments. */
const COMMENT_ANCHOR = 'issuecomment-';

const t = useTranslate();
const rootRef = useTemplateRef('root');
const commentsRef = useTemplateRef('comments');
/** The first item the fold revealed: focusable, so the keyboard picks up where the fold was. */
const revealedId = ref<string | null>(null);
/** The user showed the folded middle. */
const unfolded = ref(false);
/** The folded middle is being read. */
const readingMiddle = ref(false);
/** Reading the folded middle failed: the band says so. */
const foldFailed = ref(false);
// Before the watch below, which reads the editors: another item closes them first.
const actions = useCommentActions({
  subject: () => props.item.id,
  failedEdits: () => props.failedEdits,
  onEdit: request => emit('edit', request),
  onDiscardEdit: commentId => emit('discardEdit', commentId),
  onQuote: body => emit('quoteReply', body),
});
/** Where the user was going when leaving the item asked a reply box: Discard goes on there, Keep editing forgets it. */
let leaving: (() => void) | null = null;
/** The code thread whose reply box asks whether to discard the reply. */
const askingReply = ref<string | null>(null);
/** The code thread whose reply box takes the focus, for the moment it takes it. */
const focusedReply = ref<string | null>(null);
/** The anchors the middle was read for: each is looked for there once, found or not. */
const readFor = new Set<string>();

/** The viewer's draft review's comments, as its dialogs list them. */
const pendingComments = computed(() => getPendingComments(props.reviewThreads ?? []));
/** Code review's boxes of replies, by their thread: the one being written, and those sent until the threads read have them. */
const replyBoxes = computed(() => {
  const byThread = new Map<string, ReplyBoxes>();
  const writing = props.reviewWriting;
  for (const target of writing?.targets ?? []) {
    if (target.threadId === null) {
      continue;
    }

    const held = byThread.get(target.threadId) ?? { box: null, sent: [] };
    const status = writing?.getStatus(target.id);
    byThread.set(
      target.threadId,
      status?.kind === 'sending' || status?.kind === 'sent'
        ? { ...held, sent: [...held.sent, { id: target.id, status }] }
        : { ...held, box: target },
    );
  }

  return byThread;
});
/** What `Mod+Enter` does with a reply: what code review's first key does with it. */
const replyWay = computed(
  () => getCommentWays(props.reviewWriting?.draftOpen ?? false, props.reviewDraftFirst ?? false).first,
);
const replies = computed((): CodeThreadReplies | null => {
  const writing = props.reviewWriting;
  if (!writing) {
    return null;
  }

  return {
    repository: props.item.repository.nameWithOwner,
    itemNumber: props.item.number,
    people: props.people ?? [],
    saveLabel: getReplyLabel(),
    get: getReply,
    getResolveFailure: threadId => writing.getResolveFailure(threadId),
    setText: (threadId, text) => {
      const box = replyBoxes.value.get(threadId)?.box;
      if (box) {
        writing.setText(box.id, text);
      }
    },
    setAsking: setReplyAsking,
    send: sendReply,
    cancel: cancelReply,
  };
});
/** The threads of the viewer's draft review: no reply there. */
const draftThreads = computed(
  () =>
    new Set(entries.value.flatMap(entry => (entry.kind === 'pendingReview' ? entry.threads : [])).map(({ id }) => id)),
);
/** Everything after the description, in the thread's order: an edited comment is never folded away. */
const entries = computed(() =>
  props.detail
    ? buildThread({
        detail: props.detail,
        failedComments: props.failedComments,
        unfolded: unfolded.value,
        keepShown: new Set([...[...actions.editors.keys()].filter(id => id !== null), ...replyBoxes.value.keys()]),
        reviewThreads: props.reviewThreads ?? [],
        pendingReview: props.item.kind === 'pullRequest' ? props.item.pendingReview : null,
        viewerLogin: props.viewer?.login ?? null,
        lookedAt: props.lookedAt ?? null,
        openedAt: props.openedAt ?? null,
      })
    : [],
);

// Another item: the last one's thread is folded again and none of its reply boxes asks (its editors close in
// `useCommentActions`).
watch(
  () => props.item.id,
  () => {
    leaving = null;
    revealedId.value = null;
    unfolded.value = false;
    foldFailed.value = false;
    askingReply.value = null;
    focusedReply.value = null;
  },
);

// After the watch above, which folds the thread again for another item. `immediate` with the default `pre` flush: the
// item is often in the local copy at mount, and the comment then is in the first render, the one the router's scroll
// looks for it in.
// The review threads come after the detail: a link to a comment on the code is looked for again once they are in.
watch(() => [props.linkedAnchor, props.detail, props.reviewThreads] as const, revealLinked, { immediate: true });

defineExpose({
  /**
   * An edit is open in the thread — a card edited in place or a code thread's reply box — whether changed or not: what
   * moving the item elsewhere would close.
   */
  hasOpenEditor: computed(() => actions.editors.size > 0 || replyBoxes.value.size > 0),
  /**
   * Before the user leaves the item: the first editor, in the thread's order, whose text was changed asks whether to
   * discard it, in view and with the cursor in it; its Discard then calls `go`, the way the user was leaving. `false`
   * when none was changed: nothing stands in the way.
   */
  askToLeave,
});

function askToLeave(go: () => void) {
  const changed = getAskables().find(askable =>
    askable.kind === 'editor' ? actions.isChanged(askable.id) : isReplyChanged(askable.threadId),
  );
  if (changed === undefined) {
    return false;
  }

  if (changed.kind === 'editor') {
    askingReply.value = null;
    leaving = null;
    actions.askToLeave(changed.id, go);
  } else {
    actions.stopAsking();
    leaving = go;
    askAgain(changed.threadId);
  }

  return true;
}

/** What may ask before the item is left, in the thread's order: the editors, and the reply boxes of the code threads. */
function getAskables(): Askable[] {
  const askables: Askable[] = [{ kind: 'editor', id: null }];
  for (const entry of entries.value) {
    switch (entry.kind) {
      case 'comment':
        askables.push({ kind: 'editor', id: entry.id });
        break;
      case 'review':
        for (const { id } of [...entry.threads, ...entry.resolved]) {
          askables.push({ kind: 'reply', threadId: id });
        }

        break;
      case 'codeComment':
        askables.push({ kind: 'reply', threadId: entry.thread.id });
        break;
      default:
        break;
    }
  }

  return askables;
}

/** Asked already: asked again a tick on, so that it comes back into view and takes the cursor again. */
function askAgain(threadId: string) {
  if (askingReply.value !== threadId) {
    askingReply.value = threadId;
    return;
  }

  askingReply.value = null;
  void nextTick(() => {
    askingReply.value = threadId;
  });
}

// The fold goes with what it hid; focus moves to the first item it revealed, where it stood, instead of falling to the
// page.
async function showEarlier() {
  const at = entries.value.findIndex(entry => entry.kind === 'fold');
  if (!(await showMiddle())) {
    return;
  }

  revealedId.value = entries.value[at]?.id ?? null;
  await nextTick();
  commentsRef.value?.querySelector<HTMLElement>(':scope > [tabindex="-1"]')?.focus();
}

/**
 * Unfolds the middle, what the detail does not hold read first (nothing to read: done at once); a read that fails
 * leaves the fold, saying so. `false` when nothing was shown: the read failed, or another item is open by now.
 */
async function showMiddle() {
  const id = props.item.id;
  foldFailed.value = false;
  readingMiddle.value = true;
  try {
    await props.loadMiddle();
  } catch {
    foldFailed.value = props.item.id === id;
    return false;
  } finally {
    readingMiddle.value = false;
  }

  if (props.item.id !== id) {
    return false;
  }

  unfolded.value = true;
  return true;
}

/**
 * What the address names — a comment, a review or a comment on the code — folded away or older than what was read, is
 * shown: the middle unfolds, read from GitHub first when the detail does not hold all of it, once for each anchor. One
 * GitHub no longer has shows nothing.
 */
function revealLinked([anchor, detail, threads]: readonly [
  string | undefined,
  ItemDetail | null,
  readonly ReviewThread[] | undefined,
]) {
  if (!anchor || !detail || entries.value.some(entry => holdsEntryAnchor(entry, anchor))) {
    return;
  }

  const { comments, events } = detail;
  const held =
    [...comments.first, ...comments.nodes].some(comment => getUrlAnchor(comment.url) === anchor) ||
    (detail.kind === 'pullRequest' && detail.reviewSummaries.some(review => getUrlAnchor(review.url) === anchor)) ||
    (threads ?? []).some(thread => holdsAnchor(thread, anchor));
  if (comments.olderCursor === null && events.middle === null) {
    if (held) {
      unfolded.value = true;
    }
  } else if ((held || (anchor.startsWith(COMMENT_ANCHOR) && comments.olderCursor !== null)) && !readFor.has(anchor)) {
    readFor.add(anchor);
    void showMiddle();
  }
}

/** Whether the entry draws what the anchor names, a review's code threads included, folded or not. */
function holdsEntryAnchor(entry: ThreadItem, anchor: string) {
  switch (entry.kind) {
    case 'comment':
      return getUrlAnchor(entry.comment.url) === anchor;
    case 'review':
      return (
        getUrlAnchor(entry.review.url) === anchor ||
        [...entry.threads, ...entry.resolved].some(thread => holdsAnchor(thread, anchor))
      );
    case 'codeComment':
      return holdsAnchor(entry.thread, anchor);
    case 'pendingReview':
      return entry.threads.some(thread => holdsAnchor(thread, anchor));
    case 'events':
    case 'push':
    case 'checksFailed':
    case 'failedComment':
    case 'fold':
    case 'newSince':
      return false;
    default:
      return assertNever(entry);
  }
}

/** GitHub's anchor of a comment or a review, its `id` on the thread; a comment on its way to GitHub has none. */
function getEntryAnchor(entry: ThreadItem) {
  switch (entry.kind) {
    case 'comment':
      return getUrlAnchor(entry.comment.url);
    case 'review':
      return getUrlAnchor(entry.review.url);
    default:
      return undefined;
  }
}

function isLinked(entry: ThreadItem) {
  const anchor = getEntryAnchor(entry);
  return anchor !== undefined && anchor === props.linkedAnchor;
}

function getReplyLabel() {
  const way = replyWay.value;
  switch (way) {
    case 'single':
      return t(l.reply);
    case 'startDraft':
      return t(l.startReview);
    case 'joinDraft':
    case 'joinAndSubmit':
      return t(l.addToDraft);
    default:
      return assertNever(way);
  }
}

function getReply(threadId: string): CodeThreadReply | null {
  const held = replyBoxes.value.get(threadId);
  const writing = props.reviewWriting;
  if (!held || !writing) {
    return null;
  }

  if (!held.box) {
    return { box: null, sent: held.sent };
  }

  const status = writing.getStatus(held.box.id);
  return {
    box: {
      text: writing.getText(held.box.id),
      failure: status.kind === 'failed' ? status.failure : null,
      changed: isReplyChanged(threadId),
      asking: askingReply.value === threadId,
      focused: focusedReply.value === threadId,
    },
    sent: held.sent,
  };
}

/** Text in it, or GitHub refused it: what GitHub refused is kept until the user lets it go. */
function isReplyChanged(threadId: string) {
  const box = replyBoxes.value.get(threadId)?.box;
  const writing = props.reviewWriting;
  if (!box || !writing) {
    return false;
  }

  return writing.getText(box.id).trim() !== '' || writing.getStatus(box.id).kind === 'failed';
}

/** Code review's box on the thread's lines, the one being written there if there is one; it takes the focus. */
async function openReply(threadId: string) {
  const thread = (props.reviewThreads ?? []).find(({ id }) => id === threadId);
  const writing = props.reviewWriting;
  if (!thread || !writing || !thread.viewerCanReply || draftThreads.value.has(threadId)) {
    return;
  }

  writing.open({ path: thread.path, ...getReplyTarget(thread) });
  focusedReply.value = threadId;
  await nextTick();
  focusedReply.value = null;
}

function sendReply(threadId: string) {
  const box = replyBoxes.value.get(threadId)?.box;
  if (box) {
    props.reviewWriting?.send(box.id, replyWay.value);
    void focusThread(threadId);
  }
}

/** Cancel on an empty reply, or Discard: the box goes with its text, the focus back to its thread. */
function cancelReply(threadId: string) {
  const go = askingReply.value === threadId ? leaving : null;
  const box = replyBoxes.value.get(threadId)?.box;
  if (box) {
    props.reviewWriting?.close(box.id);
  }

  if (askingReply.value === threadId) {
    askingReply.value = null;
    leaving = null;
  }

  void focusThread(threadId);
  go?.();
}

/** The reply box's own question (Cancel, Escape) and Keep editing: neither goes anywhere after. */
function setReplyAsking(threadId: string, asking: boolean) {
  leaving = null;
  if (asking) {
    askingReply.value = threadId;
  } else if (askingReply.value === threadId) {
    askingReply.value = null;
  }
}

function setResolved(threadId: string, resolved: boolean) {
  props.reviewWriting?.setResolved(threadId, resolved);
  // The writing draws the state at once: the thread, folded to its row or opened, takes the focus, the keys still its own.
  void focusThread(threadId);
}

/** Once it is drawn again — its reply box closed, resolved or opened again, opened from its row or folded by Hide — the keys are the thread's. */
async function focusThread(threadId: string) {
  await nextTick();
  findThreadCard(threadId)?.focus({ preventScroll: true });
}

function findThreadCard(threadId: string) {
  return rootRef.value?.querySelector<HTMLElement>(`[data-code-thread="${CSS.escape(threadId)}"]`) ?? null;
}

/**
 * On a code thread (F5): `J`/`K` move to the next and previous one, staying at the first and the last, and `R` opens its
 * reply editor. Taken here, before the screen's own keys — the item's and its list's — which they are anywhere else.
 */
function onKeydown(event: KeyboardEvent) {
  const { target } = event;
  const card = target instanceof Element ? target.closest<HTMLElement>('[data-code-thread]') : null;
  if (!card || !isScreenKey(event)) {
    return;
  }

  switch (event.key) {
    case 'j':
    case 'k':
      event.preventDefault();
      moveToThread(card, event.key === 'j' ? 1 : -1);
      return;
    case 'r': {
      const threadId = card.dataset.codeThread ?? '';
      const thread = (props.reviewThreads ?? []).find(({ id }) => id === threadId);
      if (thread?.viewerCanReply && !draftThreads.value.has(threadId) && props.reviewWriting) {
        event.preventDefault();
        void openReply(threadId);
      }
    }
  }
}

function moveToThread(from: HTMLElement, by: 1 | -1) {
  const cards = [...(rootRef.value?.querySelectorAll<HTMLElement>('[data-code-thread]') ?? [])];
  const next = cards[cards.indexOf(from) + by];
  if (next) {
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest' });
  }
}

/** A thread's reply boxes in code review's writing. */
interface ReplyBoxes {
  /** The one being written, or refused. */
  readonly box: ReviewCommentTarget | null;
  readonly sent: readonly CodeThreadSentReply[];
}

/** What asks before the item is left: an editor, by its comment (`null` the description), or a code thread's reply box. */
type Askable =
  | { readonly kind: 'editor'; readonly id: string | null }
  | { readonly kind: 'reply'; readonly threadId: string };
</script>

<template>
  <div
    ref="root"
    :class="css.itemThread"
    :aria-busy="!detail || readingMiddle || reviewThreadsLoading || undefined"
    @keydown="onKeydown"
  >
    <!-- The description comes with the detail: before it, no card of it — the rail's skeleton or why stands for it. -->
    <ItemThreadMissing
      v-if="!detail"
      :item="item"
      :failed="failed"
      :read-again="readAgain"
    />
    <template v-else>
      <CommentEntry
        :id="null"
        :actions="actions"
        :author="item.author"
        :created-at="item.createdAt"
        :now="now"
        :html="detail.bodyHtml"
        :body="detail.body"
        :pending-body="detail.pendingBody"
        :url="item.url"
        :edited="detail.lastEditedAt !== null"
        :can-edit="detail.viewerCanUpdate"
        :can-quote="canQuote"
        :repository="item.repository.nameWithOwner"
        :item-number="item.number"
        :people="people"
      />
      <ol
        v-if="entries.length > 0"
        ref="comments"
        :class="css.itemThread_comments"
      >
        <li
          v-for="entry in entries"
          :id="getEntryAnchor(entry)"
          :key="entry.id"
          :tabindex="entry.id === revealedId ? -1 : undefined"
          :class="css.itemThread_comment"
          :aria-current="isLinked(entry) ? 'location' : undefined"
        >
          <ItemThreadNewSince
            v-if="entry.kind === 'newSince'"
            :count="entry.count"
          />
          <ItemThreadFold
            v-else-if="entry.kind === 'fold'"
            :commits="entry.commits"
            :comments="entry.comments"
            :other-events="entry.otherEvents"
            :failed="foldFailed"
            @click="showEarlier()"
          />
          <CommentEntry
            v-else-if="entry.kind === 'comment'"
            :id="entry.comment.id"
            :actions="actions"
            :author="entry.comment.author"
            :created-at="entry.comment.createdAt"
            :now="now"
            :html="entry.comment.bodyHtml"
            :body="entry.comment.body"
            :pending-body="entry.comment.pendingBody"
            :url="entry.comment.url"
            :edited="entry.comment.lastEditedAt !== null"
            :linked="isLinked(entry)"
            :can-edit="entry.comment.viewerCanUpdate"
            :can-delete="entry.comment.viewerCanDelete"
            :can-quote="canQuote"
            :repository="item.repository.nameWithOwner"
            :item-number="item.number"
            :people="people"
          />
          <ItemThreadEvent
            v-else-if="entry.kind === 'events' || entry.kind === 'checksFailed'"
            :entry="entry"
            :item="item"
            :now="now"
            @open="emit('open', $event)"
          />
          <ItemThreadPush
            v-else-if="entry.kind === 'push'"
            :push="entry"
            :now="now"
          />
          <ItemThreadReview
            v-else-if="entry.kind === 'review'"
            :entry="entry"
            :now="now"
            :viewer="viewer"
            :replies="replies"
            :linked-anchor="linkedAnchor"
            @reply="openReply"
            @set-resolved="setResolved"
            @toggled="focusThread"
          />
          <ItemThreadCodeComment
            v-else-if="entry.kind === 'codeComment'"
            :entry="entry"
            :now="now"
            :viewer="viewer"
            :replies="replies"
            :linked-anchor="linkedAnchor"
            @reply="openReply(entry.thread.id)"
            @set-resolved="setResolved(entry.thread.id, $event)"
            @toggled="focusThread(entry.thread.id)"
          />
          <CommentFailedCard
            v-else-if="entry.kind === 'failedComment'"
            :author="viewer ?? null"
            :now="now"
            :body="entry.failed.body"
            :reason="entry.failed.reason"
            :can-retry="canRetry"
            @discard="emit('discard', entry.failed.id)"
            @retry="emit('retry', entry.failed.id)"
          />
          <ItemThreadPendingReview
            v-else-if="entry.kind === 'pendingReview'"
            :entry="entry"
            :now="now"
            :viewer="viewer ?? null"
            :number="item.number"
            :writing="reviewWriting ?? null"
            :comments="pendingComments"
          />
        </li>
      </ol>
    </template>
    <slot name="composer" />
    <CommentDeleteDialog
      :open="actions.deletingId !== null"
      @update:open="actions.cancelDelete()"
      @delete="actions.confirmDelete()"
    />
  </div>
</template>

<style lang="scss" module="css">
// The rail: a line behind the cards, from the description down to the end, at the centre of the folds' breaks. Its own
// stacking context keeps the line over the view's background and under the cards.
.itemThread {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: $spacing-16;

  &::before {
    position: absolute;
    inset: 0 auto 0 $item-thread-rail-offset;
    z-index: -1;
    width: $item-thread-rail-width;
    content: '';
    background: $color-border;
  }
}

// 8 between the items, as the design's feed (`Activity / Thread · short`).
.itemThread_comments {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: 0;
  margin: 0;
  list-style: none;
}

// The first comment the fold revealed, once it has the focus.
.itemThread_comment {
  @include focus-ring;
}
</style>
