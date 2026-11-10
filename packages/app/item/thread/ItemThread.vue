<!-- An opened item's whole history as one thread on a rail, oldest first (`buildThread`): the description as its first card, then every comment and event read so far by time — one person's events within minutes on one line (`ItemThreadEvent`), a push with its commits (`ItemThreadPush`), a pull request's failed checks, its reviews with the threads they started (`ItemThreadReview`) and comments on the code posted alone (`ItemThreadCodeComment`) — the threads code review's own, read and written as there — and the viewer's draft review last, with code review's toolbar to finish it (`ItemThreadPendingReview`) — then the composer, there while the rest is read too. A long middle folds to one band (`buildThread`, F5): clicking it reads what GitHub has and the detail does not hold, and shows it all in place, the focus on the first revealed item; one the user must see — their comment on its way or not taken, an edit of theirs open or in flight — is never folded away. Before any of the thread is on this device — the description comes with it — no card stands: the rail says what is being read with a skeleton whose first card stands for the description, and once GitHub did not give it, why, with Try again and Open on GitHub (`ItemThreadMissing`, F16). Every text is GitHub's own rendering (`GitHubHtml`); the user's own comment on its way shows at once as the text typed, after everything GitHub told — GitHub renders it once it has it. A comment GitHub did not take stays after it, as typed, with why and Discard and Retry (Retry only while the user may comment) — until it is posted or discarded. Each card's menu (⋯ or a right click, F15) edits it in place (`ItemThreadEditor`) and deletes it — only where GitHub says the user may (K1b) — quotes it into the composer (while the user may comment) or copies its link; an edit GitHub did not take opens again with its text and why. An edit cancelled, or a delete not confirmed, gives the focus back to the card's ⋯. An edit whose text was changed asks before it is let go (`ItemThreadEditor`) — also when the user leaves the item (`askToLeave`). A code thread's "Reply…" opens its reply editor (F10), written through code review's own boxes (`CodeThreadReplies`), so it goes as code review's first key would send it and asks the same question before it is let go; Resolve and Unresolve show at once, the viewer as who resolved it. A code thread takes the focus when clicked: then `J`/`K` move to the next and previous code thread and `R` opens its reply editor (F5), instead of stepping through the items and going to the composer. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert, RotateCw } from 'lucide-vue-next';
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue';

import Button from '@/components/Button.vue';
import type { FailedComment, FailedTextEdit } from '@/edits/CommentDrafts.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import type { ReviewThread } from '@/review/threads/ReviewThread.js';
import { getCommentWays } from '@/review/writing/getCommentWays.js';
import { getPendingComments } from '@/review/writing/getPendingComments.js';
import type { ReviewCommentTarget, ReviewWriting } from '@/review/writing/ReviewWriting.js';
import type { ItemDetail } from '@/store/ItemDetailTypes.js';
import type { Item, ItemUser } from '@/store/ItemTypes.js';
import { isScreenKey } from '@/utils/isScreenKey.js';

import GitHubHtml from '../GitHubHtml.vue';
import type { ItemReference } from '../itemRoutes.js';
import { buildThread } from './buildThread.js';
import type { CodeThreadReplies, CodeThreadReply, CodeThreadSentReply } from './CodeThreadReplies.js';
import * as l from './ItemThread.loc.js';
import ItemThreadCard from './ItemThreadCard.vue';
import ItemThreadCodeComment from './ItemThreadCodeComment.vue';
import ItemThreadDeleteDialog from './ItemThreadDeleteDialog.vue';
import ItemThreadEditor from './ItemThreadEditor.vue';
import ItemThreadEvent from './ItemThreadEvent.vue';
import ItemThreadFold from './ItemThreadFold.vue';
import ItemThreadMenu from './ItemThreadMenu.vue';
import ItemThreadMissing from './ItemThreadMissing.vue';
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
  /**
   * Code review's writing of the pull request, the same that wrote them: the viewer's draft review finishes there, and
   * replies and resolving go through it.
   */
  reviewWriting?: ReviewWriting | null;
  /** With no draft open, a reply starts one rather than goes at once: code review's setting (D17). */
  reviewDraftFirst?: boolean;
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

const t = useTranslate();
const editTexts = useEditTexts();
const rootRef = useTemplateRef('root');
const commentsRef = useTemplateRef('comments');
/** The first item the fold revealed: focusable, so the keyboard picks up where the fold was. */
const revealedId = ref<string | null>(null);
/** The user showed the folded middle. */
const unfolded = ref(false);
/** Reading the folded middle failed: the band says so. */
const foldFailed = ref(false);
/** Each card edited in place, by its comment's id; `null` for the description. */
const editorsRef = shallowRef<ReadonlyMap<string | null, EditorText>>(new Map());
/** The editor whose footer asks whether to discard its changes. */
const askingRef = ref<string | null | undefined>(undefined);
/** Where the user was going when leaving the item asked: Discard goes on there, Keep editing forgets it. */
let leaving: (() => void) | null = null;
/** The editor the user just opened: it takes the focus. */
const focusedEditor = ref<string | null | undefined>(undefined);
/** The comment asked to be deleted, while the dialog asks. */
const deletingId = ref<string | null>(null);
/** The card whose ⋯ takes the focus (`null` the description's), for the moment it takes it. */
const menuFocus = ref<string | null | undefined>(undefined);
/** The text Quote reply picked, handed over once the menu closed: the composer then keeps the focus it takes. */
let quoted: string | null = null;
/** Edit opened an editor from a menu, which took the focus: the closing menu leaves it there. */
let editOpened = false;
/** The comment Delete… picked, asked about once the menu closed. */
let deleting: string | null = null;
/** The code thread whose reply box asks whether to discard the reply. */
const askingReply = ref<string | null>(null);
/** The code thread whose reply box takes the focus, for the moment it takes it. */
const focusedReply = ref<string | null>(null);
/** The threads the viewer resolved here: they say so at once, before the threads read again name who did. */
const resolvedHere = ref<ReadonlySet<string>>(new Set());

/** The viewer's draft review's comments, as its dialogs list them. */
const pendingComments = computed(() => getPendingComments(props.reviewThreads ?? []));
/** The threads, the viewer as who resolved those resolved here. */
const shownThreads = computed(() => {
  const threads = props.reviewThreads ?? [];
  const { viewer } = props;
  if (resolvedHere.value.size === 0 || !viewer) {
    return threads;
  }

  return threads.map(thread =>
    thread.isResolved && resolvedHere.value.has(thread.id) ? { ...thread, resolvedBy: viewer } : thread,
  );
});
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
        keepShown: new Set([...[...editorsRef.value.keys()].filter(id => id !== null), ...replyBoxes.value.keys()]),
        reviewThreads: shownThreads.value,
        pendingReview: props.item.kind === 'pullRequest' ? props.item.pendingReview : null,
        viewerLogin: props.viewer?.login ?? null,
      })
    : [],
);

// Another item: none of the last one's editors stays — its Update would save that item's text into this one's.
// An edit GitHub did not take opens its editor again with the text: nothing written is lost.
watch(
  [() => props.item.id, () => props.failedEdits],
  ([id, failed], before) => {
    if (id !== before[0]) {
      editorsRef.value = new Map();
      askingRef.value = undefined;
      leaving = null;
      focusedEditor.value = undefined;
      deletingId.value = null;
      revealedId.value = null;
      unfolded.value = false;
      foldFailed.value = false;
      askingReply.value = null;
      focusedReply.value = null;
      resolvedHere.value = new Set();
    }

    for (const edit of failed ?? []) {
      if (!editorsRef.value.has(edit.commentId)) {
        openEditor(edit.commentId, edit.body);
      }
    }
  },
  { immediate: true },
);

defineExpose({
  /**
   * Before the user leaves the item: the first editor, in the thread's order, whose text was changed asks whether to
   * discard it, in view and with the cursor in it; its Discard then calls `go`, the way the user was leaving. `false`
   * when none was changed: nothing stands in the way.
   */
  askToLeave,
});

function askToLeave(go: () => void) {
  const changed = getAskables().find(askable =>
    askable.kind === 'editor' ? isChanged(askable.id) : isReplyChanged(askable.threadId),
  );
  if (changed === undefined) {
    return false;
  }

  leaving = go;
  if (changed.kind === 'editor') {
    askingReply.value = null;
    askAgain(askingRef, changed.id, undefined);
  } else {
    askingRef.value = undefined;
    askAgain(askingReply, changed.threadId, null);
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
function askAgain<T>(asking: { value: T }, id: T, none: T) {
  if (asking.value !== id) {
    asking.value = id;
    return;
  }

  asking.value = none;
  void nextTick(() => {
    asking.value = id;
  });
}

function openEditor(id: string | null, text: string) {
  editorsRef.value = new Map(editorsRef.value).set(id, { text, start: text });
}

function setText(id: string | null, text: string) {
  const editor = editorsRef.value.get(id);
  if (editor) {
    editorsRef.value = new Map(editorsRef.value).set(id, { ...editor, text });
  }
}

function closeEditor(id: string | null) {
  const next = new Map(editorsRef.value);
  next.delete(id);
  editorsRef.value = next;
  if (askingRef.value === id) {
    askingRef.value = undefined;
    leaving = null;
  }
}

/** Not as the edit started, or not taken by GitHub: an edit GitHub refused counts as changed. */
function isChanged(id: string | null) {
  const editor = editorsRef.value.get(id);
  return editor !== undefined && (editor.text !== editor.start || getFailure(id) !== null);
}

/** The editor's own question (Cancel, Escape) and Keep editing: neither goes anywhere after. */
function setAsking(id: string | null, asking: boolean) {
  leaving = null;
  if (asking) {
    askingRef.value = id;
  } else if (askingRef.value === id) {
    askingRef.value = undefined;
  }
}

function getFailure(id: string | null) {
  return props.failedEdits?.find(edit => edit.commentId === id)?.reason ?? null;
}

function startEdit(id: string | null, body: string) {
  editOpened = true;
  focusedEditor.value = id;
  openEditor(id, body);
}

function cancelEdit(id: string | null) {
  const go = askingRef.value === id ? leaving : null;
  closeEditor(id);
  void focusMenu(id);
  if (getFailure(id)) {
    emit('discardEdit', id);
  }

  go?.();
}

/** The card's ⋯ takes the focus once the card is on screen again. */
async function focusMenu(id: string | null) {
  menuFocus.value = id;
  await nextTick();
  menuFocus.value = undefined;
}

/** Saved as it was: nothing to send, unless it is an edit GitHub did not take. */
function saveEdit(id: string | null, body: string) {
  const text = editorsRef.value.get(id)?.text ?? '';
  closeEditor(id);
  if (text === body && !getFailure(id)) {
    return;
  }

  emit('edit', id === null ? { kind: 'editBody', body: text } : { kind: 'editComment', commentId: id, body: text });
}

function confirmDelete() {
  const id = deletingId.value;
  deletingId.value = null;
  if (id !== null) {
    emit('edit', { kind: 'deleteComment', commentId: id });
  }
}

function quote(body: string) {
  quoted = body;
}

function askDelete(id: string) {
  deleting = id;
}

// The dialog opens only once the focus is on the card's ⋯ — not on the menu's entry, gone with the menu — so its Cancel
// gives the focus back there.
async function onMenuClose(event: Event) {
  const asked = deleting;
  if (editOpened || quoted !== null || asked !== null) {
    event.preventDefault();
  }

  if (quoted !== null) {
    emit('quoteReply', quoted);
  }

  editOpened = false;
  quoted = null;
  deleting = null;
  if (asked !== null) {
    await focusMenu(asked);
    deletingId.value = asked;
  }
}

function copyLink(url: string) {
  void navigator.clipboard.writeText(url);
}

// The fold goes with what it hid; focus moves to the first item it revealed, where it stood, instead of falling to the
// page. What the detail does not hold is read first (nothing to read: done at once); a read that fails leaves the
// fold, saying so.
async function showEarlier() {
  const at = entries.value.findIndex(entry => entry.kind === 'fold');
  const id = props.item.id;
  foldFailed.value = false;
  try {
    await props.loadMiddle();
  } catch {
    foldFailed.value = props.item.id === id;
    return;
  }

  if (props.item.id !== id) {
    return;
  }

  unfolded.value = true;
  revealedId.value = entries.value[at]?.id ?? null;
  await nextTick();
  commentsRef.value?.querySelector<HTMLElement>(':scope > [tabindex="-1"]')?.focus();
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
  const thread = shownThreads.value.find(({ id }) => id === threadId);
  const writing = props.reviewWriting;
  if (!thread || !writing || !thread.viewerCanReply || draftThreads.value.has(threadId)) {
    return;
  }

  const line = thread.line ?? thread.originalLine ?? 1;
  writing.open({
    path: thread.path,
    side: thread.diffSide === 'LEFT' ? 'before' : 'after',
    line,
    startLine: thread.startLine === null || thread.startLine === line ? null : thread.startLine,
    threadId,
  });
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
  const here = new Set(resolvedHere.value);
  if (resolved) {
    here.add(threadId);
  } else {
    here.delete(threadId);
  }

  resolvedHere.value = here;
  props.reviewWriting?.setResolved(threadId, resolved);
}

/** Once it is drawn again: the keys are the thread's, as they were before its reply box opened. */
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
      const thread = shownThreads.value.find(({ id }) => id === threadId);
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

/** A card's text being edited, and the text the edit started with. */
interface EditorText {
  readonly text: string;
  readonly start: string;
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
      <ItemThreadEditor
        v-if="editorsRef.has(null)"
        :text="editorsRef.get(null)?.text ?? ''"
        :author="item.author"
        :repository="item.repository.nameWithOwner"
        :item-number="item.number"
        :people="people"
        :reason="getFailure(null)"
        :autofocus="focusedEditor === null"
        :changed="isChanged(null)"
        :asking="askingRef === null"
        kind="description"
        @update:text="setText(null, $event)"
        @update:asking="setAsking(null, $event)"
        @save="saveEdit(null, detail.body)"
        @cancel="cancelEdit(null)"
      />
      <ItemThreadCard
        v-else
        :author="item.author"
        :created-at="item.createdAt"
        :now="now"
        :edited="detail.lastEditedAt !== null"
        :sending="detail.pendingBody !== undefined"
        :menu-focused="menuFocus === null"
        description
        @menu-close="onMenuClose"
      >
        <p
          v-if="detail.pendingBody !== undefined"
          :class="[css.itemThread_typed, css.itemThread_pending]"
          v-text="detail.pendingBody"
        />
        <GitHubHtml
          v-else-if="detail.bodyHtml"
          :class="css.itemThread_text"
          :html="detail.bodyHtml"
        />
        <p
          v-else
          :class="css.itemThread_note"
        >
          {{ t(l.noDescription) }}
        </p>
        <template #menu>
          <ItemThreadMenu
            :can-edit="detail.viewerCanUpdate && detail.pendingBody === undefined"
            :can-quote="canQuote"
            @edit="startEdit(null, detail.body)"
            @quote-reply="quote(detail.body)"
            @copy-link="copyLink(item.url)"
          />
        </template>
      </ItemThreadCard>
      <ol
        v-if="entries.length > 0"
        ref="comments"
        :class="css.itemThread_comments"
      >
        <li
          v-for="entry in entries"
          :key="entry.id"
          :tabindex="entry.id === revealedId ? -1 : undefined"
          :class="css.itemThread_comment"
        >
          <ItemThreadFold
            v-if="entry.kind === 'fold'"
            :commits="entry.commits"
            :comments="entry.comments"
            :other-events="entry.otherEvents"
            :failed="foldFailed"
            @click="showEarlier()"
          />
          <template v-else-if="entry.kind === 'comment'">
            <ItemThreadEditor
              v-if="editorsRef.has(entry.comment.id)"
              :text="editorsRef.get(entry.comment.id)?.text ?? ''"
              :author="entry.comment.author"
              :repository="item.repository.nameWithOwner"
              :item-number="item.number"
              :people="people"
              :reason="getFailure(entry.comment.id)"
              :autofocus="focusedEditor === entry.comment.id"
              :changed="isChanged(entry.comment.id)"
              :asking="askingRef === entry.comment.id"
              @update:text="setText(entry.comment.id, $event)"
              @update:asking="setAsking(entry.comment.id, $event)"
              @save="saveEdit(entry.comment.id, entry.comment.body)"
              @cancel="cancelEdit(entry.comment.id)"
            />
            <ItemThreadCard
              v-else
              :author="entry.comment.author"
              :created-at="entry.comment.createdAt"
              :now="now"
              :edited="entry.comment.lastEditedAt !== null"
              :sending="entry.comment.pendingBody !== undefined"
              :menu-focused="menuFocus === entry.comment.id"
              @menu-close="onMenuClose"
            >
              <!-- `v-text`: text only, without the template's whitespace around it, which `pre-wrap` would show. -->
              <p
                v-if="entry.comment.pendingBody !== undefined"
                :class="[css.itemThread_typed, css.itemThread_pending]"
                v-text="entry.comment.pendingBody"
              />
              <GitHubHtml
                v-else
                :class="css.itemThread_text"
                :html="entry.comment.bodyHtml"
              />
              <!-- On its way, it has nothing GitHub would act on yet. -->
              <template
                v-if="entry.comment.pendingBody === undefined"
                #menu
              >
                <ItemThreadMenu
                  :can-edit="entry.comment.viewerCanUpdate"
                  :can-quote="canQuote"
                  :can-delete="entry.comment.viewerCanDelete"
                  @edit="startEdit(entry.comment.id, entry.comment.body)"
                  @quote-reply="quote(entry.comment.body)"
                  @copy-link="copyLink(entry.comment.url)"
                  @delete="askDelete(entry.comment.id)"
                />
              </template>
            </ItemThreadCard>
          </template>
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
            @reply="openReply"
            @set-resolved="setResolved"
          />
          <ItemThreadCodeComment
            v-else-if="entry.kind === 'codeComment'"
            :entry="entry"
            :now="now"
            :viewer="viewer"
            :replies="replies"
            @reply="openReply(entry.thread.id)"
            @set-resolved="setResolved(entry.thread.id, $event)"
          />
          <ItemThreadCard
            v-else-if="entry.kind === 'failedComment'"
            :author="viewer ?? null"
            :now="now"
            failed
          >
            <p
              :class="css.itemThread_typed"
              v-text="entry.failed.body"
            />
            <template #footer>
              <div :class="css.itemThread_failed">
                <CircleAlert
                  :class="css.itemThread_failedIcon"
                  aria-hidden="true"
                />
                <span
                  :class="css.itemThread_failedText"
                  role="alert"
                  >{{ editTexts.notSent(entry.failed.reason) }}</span
                >
                <Button
                  size="compact"
                  @click="emit('discard', entry.failed.id)"
                >
                  {{ t(l.discard) }}
                </Button>
                <Button
                  v-if="canRetry"
                  size="compact"
                  :icon="RotateCw"
                  @click="emit('retry', entry.failed.id)"
                >
                  {{ t(l.retry) }}
                </Button>
              </div>
            </template>
          </ItemThreadCard>
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
    <ItemThreadDeleteDialog
      :open="deletingId !== null"
      @update:open="deletingId = null"
      @delete="confirmDelete"
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

// A body or comment GitHub rendered, at the thread's reading size.
.itemThread_text {
  --github-html-font-size: #{$font-size-reading};
  --github-html-line-height: #{$line-height-reading};
  --github-html-color: #{$color-fg};
}

// As typed: GitHub has not rendered it. As GitHub's rendering of it will read.
.itemThread_typed {
  margin: 0;
  font-size: $font-size-reading;
  line-height: $line-height-reading;
  color: $color-fg;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

// On its way, dimmed (not faded: it stays readable): GitHub's rendering replaces it once GitHub has it.
.itemThread_pending {
  color: $color-fg-dim;
}

// Why it wasn't sent, at the bottom of the card: Primer's danger, muted.
.itemThread_failed {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-8 $spacing-10 $spacing-8 $spacing-14;
  background: $color-bg-danger;
  border-top: 1px solid $color-border-danger;
}

.itemThread_failedIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-red;
}

.itemThread_failedText {
  flex: 1;
  min-width: 0;
  font-size: $font-size-sm;
  line-height: 1.45;
  color: $color-fg;
}

.itemThread_note {
  margin: 0;
  font-size: $font-size-md;
  color: $color-fg-dim;
}
</style>
