<!-- The item an address opens, in its arrangement (D9): found and kept current (`useOpenedItem`), shown in the item view — in a dialog for `modal`, which takes focus itself and is widened by dragging its edges, its width remembered in this browser — and moved through. `K`/`J` step through the list it was opened from — and a row of a pull request's stack map opens one in its place, as they do, the stack read from the local copy — the switch moves it to another arrangement (remembered in this browser as the one to open in next), and closing goes back to the list, where it stays selected. "Merge…" opens the merge panel for it (merging D7), and once the merge is sent the panel or modal moves on, as a list does (PM32a); an Undo of a close shows the undone item on the item's page; a pull request with checks failing or running has its merge options read, for which of them are required (D13): its tags, and the standing's verdict, the same as the panel's. Moving to another item, or between the page and the list, replaces the address — between the panel and the modal it stays, for the address does not say which; opening a linked item — from the item's links, or a link to one in its body or comments (`ItemLinkContext`) — or closing adds one, so Back returns. The comment the address's fragment names is handed to the view, whose thread shows and marks it. When the user last looked at the item, and when they opened it, are handed to the view too, for its thread's "N new since you looked" — held while it stays open, in another arrangement too, until another item opens or it is closed; while the tab shows it, the newest of its thread is kept as seen (`ItemLookedStore`). On its page, the address settles on the item's kind once it is known (`/issues/15` of a pull request becomes `/pull/15`, as GitHub redirects). Leaving the item while an edit in its thread has changes asks first, and the item stays; Discard then goes on where the user was going. -->
<script lang="ts" setup>
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { useDataSource } from '@nzyme/vue-utils/useDataSource.js';
import { SearchX } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onScopeDispose, ref, useTemplateRef, watch } from 'vue';
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import { usePanelWidth } from '@/components/usePanelWidth.js';
import { CommentDrafts } from '@/edits/CommentDrafts.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { MergePanelStore } from '@/merge/MergePanelStore.js';
import { useMergeOptions } from '@/merge/useMergeOptions.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { AuthStore } from '@/auth/AuthStore.js';
import { useNow } from '@/services/useNow.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemLookedStore } from '@/store/ItemLookedStore.js';
import type { ItemOpening } from '@/store/ItemLookedStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import type { ItemEditing } from './ItemEditing.js';
import { ItemLinkContext } from './ItemLinkContext.js';
import { ItemNavigation } from './ItemNavigation.js';
import {
  formatItemReference,
  getItemPagePath,
  getItemReference,
  getOpenedItemQuery,
  getOpenedItemRoute,
  getReviewPath,
} from './itemRoutes.js';
import type { ItemArrangement, ItemReference } from './itemRoutes.js';
import ItemView from './ItemView.vue';
import * as l from './OpenedItem.loc.js';
import { useItemStack } from './useItemStack.js';
import { useItemWalk } from './useItemWalk.js';
import { getThreadNewestAt } from './thread/buildThread.js';
import { useOpenedItem } from './useOpenedItem.js';

const props = defineProps<{
  reference: ItemReference;
  arrangement: ItemArrangement;
}>();

/** How often the ages ("2h") move on. */
const TICK_MS = 30_000;

const t = useTranslate();
const details = useService(ItemDetailStore);
const navigation = useService(ItemNavigation);
const editor = useService(ItemEditor);
const repositories = useService(RepositoryStore);
const auth = useService(AuthStore);
const drafts = useService(CommentDrafts);
const mergePanel = useService(MergePanelStore);
const tracking = useService(TrackingStore);
const itemLooked = useService(ItemLookedStore);
const route = useRoute();
const router = useRouter();

// A link to an item in its body or comments opens that item as a linked one does: here, in this arrangement.
provideContext(ItemLinkContext, { open: openLinked });

const opened = useOpenedItem({ reference: () => props.reference });
// In the panel the list's cursor moves with `K`/`J`, and what they reach is the cursor's neighbours. The page has no list,
// the last one's cursor stale, and the modal leaves the keys to the opened item: both walk the steps — but for an item
// that left the list under the modal, which has no step: the cursor's neighbours then are the way back in.
const walk = useItemWalk({
  id: () => opened.id,
  followsCursor: listed => props.arrangement === 'panel' || (props.arrangement === 'modal' && !listed),
});
const stack = useItemStack(() => opened.item);
// When the user last looked at it before opening it (F5), and when they opened it: read from this device as it opens —
// another tab's look counts — and held while it stays open, in another arrangement too (`ItemLookedStore`), so the
// line stays until they leave. A read that comes back for an item already left keeps what is there: only the opened
// item's own time shows.
const looked = useDataSource({
  params: () => opened.id,
  load: async (id): Promise<LookedRead | null> => {
    if (id === null) {
      return null;
    }

    const opening = await itemLooked.open(id);
    return id === opened.id ? { id, ...opening } : looked.value;
  },
  default: null,
  behavior: 'eager',
});
const opening = computed(() => (looked.value?.id === opened.id ? looked.value : null));
/** The newest item of the thread GitHub has, as it shows. */
const newestAt = computed(() =>
  opened.detail ? getThreadNewestAt({ detail: opened.detail, reviewThreads: opened.reviewThreads }) : null,
);
const visible = ref(document.visibilityState === 'visible');
const viewRef = useTemplateRef<InstanceType<typeof ItemView>>('view');
// The modal's width, resized by dragging its left or right edge.
const modalWidth = usePanelWidth({ key: 'itemModal', default: 1440, min: 720 });
const now = useNow(TICK_MS);
// Which checks are required only the merge options say (merging D13): read for an open pull request with checks
// failing or running — what the standing then weighs, as the merge panel does — and again when the row's counts move.
const mergeOptions = useMergeOptions({
  itemId: () => {
    const { item } = opened;
    const checks = item?.kind === 'pullRequest' && item.state === 'OPEN' ? item.checks : null;
    return checks && checks.failing + checks.pending > 0 ? opened.id : null;
  },
  readAgainOn: () => {
    const { item } = opened;
    return item?.kind === 'pullRequest' && item.checks ? `${item.checks.failing}/${item.checks.pending}` : null;
  },
});

// The comment the address's fragment names (`#issuecomment-…`), shown and marked; vue-router gives the hash decoded.
const linkedAnchor = computed(() => route.hash.slice(1));
const referenceText = computed(() => `${props.reference.owner}/${props.reference.name}#${props.reference.number}`);
/** What shows until the item does. */
const waitingTitle = computed(() => {
  if (opened.missing) {
    return t(l.missing);
  }

  return opened.failed ? t(l.unreachable) : t(l.opening, { reference: referenceText.value });
});
const closes = computed((): Item[] => {
  const { item } = opened;
  if (item?.kind !== 'pullRequest') {
    return [];
  }

  return mapNotNull(item.closingIssueIds, id => details.getItem(id));
});

// The comment box holds the opened item's draft: it stays with the item while the user moves on.
const commentDraft = computed({
  get: () => (opened.id === null ? '' : drafts.get(opened.id)),
  set: (text: string) => {
    if (opened.id !== null) {
      drafts.set(opened.id, text);
    }
  },
});

const failedComments = computed(() => (opened.id === null ? [] : drafts.getFailed(opened.id)));
const failedEdits = computed(() => (opened.id === null ? [] : drafts.getFailedEdits(opened.id)));

const editing = computed((): ItemEditing | null => {
  const { item } = opened;
  const viewer = auth.viewer;
  if (!item || !viewer) {
    return null;
  }

  return {
    permissions: editor.getPermissions(item),
    metadata: repositories.get(item.repository.nameWithOwner) ?? null,
    viewerLogin: viewer.login,
    viewerAvatarUrl: viewer.avatarUrl,
    viewerProjects: repositories.viewerProjects,
  };
});

// While the tab shows the item, the newest of its thread is kept as seen, as it comes — once the time it opened with is
// read, for that one to be the line's. A hidden tab keeps nothing: what arrives then was never seen.
watch(
  () => [opened.id, opening.value !== null, visible.value, newestAt.value] as const,
  ([id, read, shows, newest]) => {
    if (id !== null && read && shows && newest !== null) {
      itemLooked.mark(id, newest);
    }
  },
  { immediate: true },
);
watch(
  () => opened.id,
  () => looked.clear(),
);
onWindowEvent('visibilitychange', () => {
  visible.value = document.visibilityState === 'visible';
});
// Closed, it is left: opened again, its time is read afresh. Moved to another arrangement, the address still opens an
// item — this one, held, or another, which replaces it.
onScopeDispose(() => {
  if (opened.id !== null && !getOpenedItemRoute(router.currentRoute.value)) {
    itemLooked.leave(opened.id);
  }
});

// What the pickers offer, and what the user may do there, read as the item opens (and every 10 minutes).
watch(
  () => opened.item?.repository.nameWithOwner,
  repository => {
    if (repository) {
      void repositories.ensure(repository);
    }
  },
  { immediate: true },
);

// "Comment" in a list's context menu: the cursor goes into the comment box once the item is shown.
watch(
  () => [navigation.commentRequest, opened.id, viewRef.value] as const,
  async ([requested, id, view]) => {
    if (requested !== null && requested === id && view) {
      navigation.requestComment(null);
      await nextTick();
      view.focusComposer();
    }
  },
  { immediate: true },
);

// On its page, `/issues/15` of a pull request settles on `/pull/15` and the other way round, as GitHub redirects —
// in place, keeping the query and the fragment; both pages are one instance (`meta.key`), so nothing remounts.
watch(
  () => [opened.item, route.path] as const,
  ([item, path]) => {
    if (props.arrangement !== 'page' || item?.number !== props.reference.number) {
      return;
    }

    const settled = getItemPagePath(props.reference, item.kind);
    if (path !== settled) {
      void router.replace({ path: settled, query: route.query, hash: route.hash });
    }
  },
  { immediate: true },
);

// An Undo of a close (D29): over a list its cursor goes back (`useItemList`); on the item's page, with no list under it, the
// page shows the undone item, unless it does already.
watch(
  () => navigation.returnRequest,
  request => {
    const [first] = request?.ids ?? [];
    if (props.arrangement === 'page' && first !== undefined && !request?.ids.includes(opened.id ?? '')) {
      openInPlace(first);
    }
  },
);

// Back and Forward move through the history before the guard below runs, and the router moves back when it stops them:
// how far they went, for Discard to go there again.
let poppedBy: number | null = null;
const removeHistoryListener = router.options.history.listen((_to, _from, info) => {
  poppedBy = info.delta;
});
// How the item's own navigation on its way goes — adding to the history or replacing the address (`moveTo`).
let movingBy: HistoryMove | null = null;

// Leaving the item — `K`/`J`, another item opened, closing it, anywhere else — while an edit in its thread has changes:
// the edit asks first and the item stays; its Discard then goes on where the user was going.
const removeLeaveGuard = router.beforeEach(to => {
  const popped = poppedBy;
  const by = movingBy;
  poppedBy = null;
  movingBy = null;
  const next = getOpenedItemRoute(to);
  const staying =
    next !== null &&
    formatItemReference(next.reference).toLowerCase() === formatItemReference(props.reference).toLowerCase();
  if (staying || !viewRef.value?.askToLeave(() => goAgain({ to, popped, by }))) {
    return true;
  }

  // The list's cursor moved ahead of the step (its own `j`/`k`): it comes back.
  if (opened.id !== null) {
    navigation.requestStay(opened.id);
  }

  return false;
});

onBeforeUnmount(() => {
  removeLeaveGuard();
  removeHistoryListener();
});

/**
 * The navigation an edit stopped, once its changes are discarded, made again as it was: Back or Forward as far; the
 * item's own as it went (`moveTo`); from elsewhere, another item over the same list — the list's `J`/`K` — replacing
 * the address, the rest adding to the history.
 */
function goAgain({ to, popped, by }: GoAgainOptions) {
  if (popped !== null && popped !== 0) {
    router.go(popped);
    return;
  }

  const next = getOpenedItemRoute(to);
  const listStep = next !== null && !next.onPage && props.arrangement !== 'page' && to.path === route.path;
  const how = by ?? (listStep ? 'replace' : 'push');
  void (how === 'replace' ? router.replace(to.fullPath) : router.push(to.fullPath));
}

function merge() {
  const { id } = opened;
  if (id !== null) {
    mergePanel.open(id, { onSent: merged => moveOnFrom(id, merged) });
  }
}

/** A merge sent moves on at once, as from a list (PM32a); on its page, with no list under it, the item stays. */
function moveOnFrom(id: string, merged: readonly string[]) {
  if (opened.id !== id) {
    return;
  }

  switch (props.arrangement) {
    case 'panel':
      navigation.requestMoveOn(merged);
      break;
    case 'modal':
      step(walk.neighbours.next === null ? -1 : 1);
      break;
    case 'page':
      break;
    default:
      assertNever(props.arrangement);
  }
}

function step(delta: 1 | -1) {
  const side = delta === 1 ? 'next' : 'previous';
  // The cursor's neighbour can be the opened item's own row, which a button has nothing to open on: on past it.
  const target = walk.neighbours[side] === opened.id ? walk.stepNeighbours[side] : walk.neighbours[side];
  if (target !== null) {
    openInPlace(target);
  }
}

/** Opens the item in the opened one's place, replacing the address: `K`/`J` and a row of a stack's map. */
function openInPlace(id: string) {
  const item = details.getItem(id);
  if (item) {
    moveTo(locate(getItemReference(item), props.arrangement, item.kind), 'replace');
  }
}

function arrange(arrangement: ItemArrangement) {
  navigation.setArrangement(arrangement);
  // Between the panel and the modal the address stays: the shell shows the remembered one.
  if (arrangement === 'page' || props.arrangement === 'page') {
    moveTo(locate(props.reference, arrangement, opened.item?.kind), 'replace');
  }
}

function open(reference: ItemReference) {
  moveTo(locate(reference, props.arrangement), 'push');
}

/** A link to an item in its body or comments: opened as `open` does, keeping the fragment it names. */
function openLinked(reference: ItemReference, hash: string) {
  const to = locate(reference, props.arrangement);
  moveTo(typeof to === 'string' ? `${to}${hash}` : { ...to, hash }, 'push');
}

/** Navigates as `by` says, remembered for the guard: an edit stopping it and discarded goes on the same way (`goAgain`). */
function moveTo(to: RouteLocationRaw, by: HistoryMove) {
  movingBy = by;
  void (by === 'replace' ? router.replace(to) : router.push(to)).finally(() => {
    movingBy = null;
  });
}

/** Always the full page, whatever the arrangement (code review's D2); Back returns. */
function openReview() {
  moveTo(getReviewPath(props.reference), 'push');
}

function close() {
  moveTo(
    props.arrangement === 'page' ? listPath() : { path: route.path, query: getOpenedItemQuery(route.query, null) },
    'push',
  );
}

/** Where `reference` opens in `arrangement`: its page, or the list with it opened over it. */
function locate(reference: ItemReference, arrangement: ItemArrangement, kind?: Item['kind']): RouteLocationRaw {
  if (arrangement === 'page') {
    return getItemPagePath(reference, kind);
  }

  // From the item's page, back over the list it came from.
  const list = props.arrangement === 'page' ? router.resolve(listPath()) : route;
  return { path: list.path, query: getOpenedItemQuery(list.query, reference) };
}

function listPath() {
  return navigation.list?.path ?? '/';
}

function edit(request: EditRequest) {
  const { id } = opened;
  if (id !== null) {
    void editor.edit([id], request);
  }
}

function discardEdit(commentId: string | null) {
  if (opened.id !== null) {
    drafts.discardFailedEdit(opened.id, commentId);
  }
}

function retryComment(id: number) {
  void editor.retryComment(id);
}

/**
 * Opened, the modal takes focus itself rather than its first button (the item menu's), which would show a focus ring
 * no one asked for; the window's title is read out, and Tab goes on into it.
 */
function focusModal(event: Event) {
  event.preventDefault();
  (event.target as HTMLElement).focus();
}

/**
 * Escape in a field leaves it and the modal stays, as the panel and the page do (the item view's Escape): an editor
 * opened in place takes the key itself (it closes, or asks), the comment box loses the cursor. The modal hears the key before the item view,
 * which then leaves it alone; a second Escape closes the item.
 */
function onModalEscape(event: KeyboardEvent) {
  const { target } = event;
  if (event.defaultPrevented) {
    return;
  }

  if (target instanceof HTMLElement && isEditableTarget(target)) {
    event.preventDefault();
    target.blur();
  }
}

function loadViewerProjects() {
  void repositories.ensureViewerProjects();
}

/** The navigation an edit stopped, for `goAgain`. */
interface GoAgainOptions {
  readonly to: RouteLocationNormalized;
  /** How far Back or Forward went; `null` for a navigation of the app's own. */
  readonly popped: number | null;
  /** How the item's own navigation went; `null` for one from elsewhere. */
  readonly by: HistoryMove | null;
}

type HistoryMove = 'push' | 'replace';

/** An item as the user opened it, read for it. */
interface LookedRead extends ItemOpening {
  readonly id: string;
}
</script>

<template>
  <Dialog
    v-if="arrangement === 'modal'"
    v-model:width="modalWidth.current"
    :open="true"
    :title="opened.item?.title ?? referenceText"
    :min-width="modalWidth.min"
    :resize-label="t(l.resizeModal)"
    bare
    @update:open="close"
    @open-auto-focus="focusModal"
    @escape-key-down="onModalEscape"
    @resized="modalWidth.save()"
  >
    <ItemView
      v-if="opened.item"
      ref="view"
      v-model:comment-draft="commentDraft"
      :item="opened.item"
      :detail="opened.detail"
      arrangement="modal"
      :position="walk.position"
      :closes="closes"
      :now="now"
      :load-thread-middle="opened.loadThreadMiddle"
      :detail-failed="opened.detailFailed"
      :read-detail-again="opened.readDetailAgain"
      :linked-anchor="linkedAnchor"
      :editing="editing"
      :stack="stack"
      :neighbours="walk.neighbours"
      :merge-checks="mergeOptions.options?.checks ?? null"
      :viewer-can-enable-auto-merge="mergeOptions.options?.viewerCanEnableAutoMerge ?? null"
      :failed-comments="failedComments"
      :failed-edits="failedEdits"
      :review-threads="opened.reviewThreads"
      :review-threads-loading="opened.reviewThreadsLoading"
      :review-writing="opened.reviewWriting"
      :review-draft-first="tracking.reviewCommentChoice === 'draft'"
      :looked-at="opening?.lookedAt ?? null"
      :opened-at="opening?.openedAt ?? null"
      @edit="edit"
      @retry-comment="retryComment"
      @discard-comment="drafts.discardFailed($event)"
      @discard-edit="discardEdit"
      @merge="merge"
      @need-projects="loadViewerProjects"
      @close="close"
      @previous="step(-1)"
      @next="step(1)"
      @arrange="arrange"
      @open="open"
      @open-in-place="openInPlace"
      @review="openReview"
    />
    <EmptyState
      v-else
      :icon="SearchX"
      :title="waitingTitle"
      :detail="opened.missing ? t(l.missingDetail, { reference: referenceText }) : undefined"
    >
      <template
        v-if="opened.failed"
        #action
      >
        <Button
          size="sm"
          @click="opened.tryAgain()"
        >
          {{ t(l.tryAgain) }}
        </Button>
      </template>
    </EmptyState>
  </Dialog>
  <ItemView
    v-else-if="opened.item"
    ref="view"
    v-model:comment-draft="commentDraft"
    :item="opened.item"
    :detail="opened.detail"
    :arrangement="arrangement"
    :position="walk.position"
    :closes="closes"
    :now="now"
    :load-thread-middle="opened.loadThreadMiddle"
    :detail-failed="opened.detailFailed"
    :read-detail-again="opened.readDetailAgain"
    :linked-anchor="linkedAnchor"
    :editing="editing"
    :stack="stack"
    :neighbours="walk.neighbours"
    :merge-checks="mergeOptions.options?.checks ?? null"
    :viewer-can-enable-auto-merge="mergeOptions.options?.viewerCanEnableAutoMerge ?? null"
    :failed-comments="failedComments"
    :failed-edits="failedEdits"
    :review-threads="opened.reviewThreads"
    :review-threads-loading="opened.reviewThreadsLoading"
    :review-writing="opened.reviewWriting"
    :review-draft-first="tracking.reviewCommentChoice === 'draft'"
    :looked-at="opening?.lookedAt ?? null"
    :opened-at="opening?.openedAt ?? null"
    @edit="edit"
    @retry-comment="retryComment"
    @discard-comment="drafts.discardFailed($event)"
    @discard-edit="discardEdit"
    @merge="merge"
    @need-projects="loadViewerProjects"
    @close="close"
    @previous="step(-1)"
    @next="step(1)"
    @arrange="arrange"
    @open="open"
    @open-in-place="openInPlace"
    @review="openReview"
  />
  <div
    v-else
    :class="css.openedItem_waiting"
  >
    <EmptyState
      :icon="SearchX"
      :title="waitingTitle"
      :detail="opened.missing ? t(l.missingDetail, { reference: referenceText }) : undefined"
    >
      <template
        v-if="opened.missing"
        #action
      >
        <Button
          size="sm"
          @click="close"
        >
          {{ t(l.backToList) }}
        </Button>
      </template>
      <template
        v-else-if="opened.failed"
        #action
      >
        <Button
          size="sm"
          @click="opened.tryAgain()"
        >
          {{ t(l.tryAgain) }}
        </Button>
      </template>
    </EmptyState>
  </div>
</template>

<style lang="scss" module="css">
.openedItem_waiting {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: $color-bg-item;
}
</style>
