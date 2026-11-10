<!-- The item an address opens, in its arrangement (D9): found and kept current (`useOpenedItem`), shown in the item view — in a dialog for `modal`, which takes focus itself and is widened by dragging its edges, its width remembered in this browser — and moved through. `K`/`J` step through the list it was opened from — and a row of a pull request's stack map opens one in its place, as they do, the stack read from the local copy — the switch moves it to another arrangement (remembered in this browser as the one to open in next), and closing goes back to the list, where it stays selected. "Merge…" opens the merge panel for it (merging D7), and once the merge is sent the panel or modal moves on, as a list does (PM32a); an Undo of a close shows the undone item on the item's page; a pull request with checks failing or running has its merge options read, for which of them are required (D13): its tags, and the standing's verdict, the same as the panel's. Moving to another item, or between the page and the list, replaces the address — between the panel and the modal it stays, for the address does not say which; opening a linked item or closing adds one, so Back returns. On its page, the address settles on the item's kind once it is known (`/issues/15` of a pull request becomes `/pull/15`, as GitHub redirects). -->
<script lang="ts" setup>
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { SearchX } from 'lucide-vue-next';
import { computed, nextTick, useTemplateRef, watch } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
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
import type { Item } from '@/store/ItemTypes.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';

import type { ItemEditing } from './ItemEditing.js';
import { ItemNavigation } from './ItemNavigation.js';
import { getItemPagePath, getItemReference, getOpenedItemQuery, getReviewPath } from './itemRoutes.js';
import type { ItemArrangement, ItemReference } from './itemRoutes.js';
import ItemView from './ItemView.vue';
import * as l from './OpenedItem.loc.js';
import { useItemStack } from './useItemStack.js';
import { useItemWalk } from './useItemWalk.js';
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
const route = useRoute();
const router = useRouter();

const opened = useOpenedItem({ reference: () => props.reference });
// In the panel the list's cursor moves with `K`/`J`, and what they reach is the cursor's neighbours. The page has no list,
// the last one's cursor stale, and the modal leaves the keys to the opened item: both walk the steps — but for an item
// that left the list under the modal, which has no step: the cursor's neighbours then are the way back in.
const walk = useItemWalk({
  id: () => opened.id,
  followsCursor: listed => props.arrangement === 'panel' || (props.arrangement === 'modal' && !listed),
});
const stack = useItemStack(() => opened.item);
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
    void router.replace(locate(getItemReference(item), props.arrangement, item.kind));
  }
}

function arrange(arrangement: ItemArrangement) {
  navigation.setArrangement(arrangement);
  // Between the panel and the modal the address stays: the shell shows the remembered one.
  if (arrangement === 'page' || props.arrangement === 'page') {
    void router.replace(locate(props.reference, arrangement, opened.item?.kind));
  }
}

function open(reference: ItemReference) {
  void router.push(locate(reference, props.arrangement));
}

/** Always the full page, whatever the arrangement (code review's D2); Back returns. */
function openReview() {
  void router.push(getReviewPath(props.reference));
}

function close() {
  void router.push(
    props.arrangement === 'page' ? listPath() : { path: route.path, query: getOpenedItemQuery(route.query, null) },
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
 * opened in place has cancelled itself, the comment box loses the cursor. The modal hears the key before the item view,
 * which then leaves it alone; a second Escape closes the item.
 */
function onModalEscape(event: KeyboardEvent) {
  const { target } = event;
  if (target instanceof HTMLElement && isEditableTarget(target)) {
    event.preventDefault();
    target.blur();
  }
}

function loadViewerProjects() {
  void repositories.ensureViewerProjects();
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
      :load-all-comments="opened.loadAllComments"
      :editing="editing"
      :stack="stack"
      :neighbours="walk.neighbours"
      :merge-checks="mergeOptions.options?.checks ?? null"
      :viewer-can-enable-auto-merge="mergeOptions.options?.viewerCanEnableAutoMerge ?? null"
      :failed-comments="failedComments"
      :failed-edits="failedEdits"
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
    :load-all-comments="opened.loadAllComments"
    :editing="editing"
    :stack="stack"
    :neighbours="walk.neighbours"
    :merge-checks="mergeOptions.options?.checks ?? null"
    :viewer-can-enable-auto-merge="mergeOptions.options?.viewerCanEnableAutoMerge ?? null"
    :failed-comments="failedComments"
    :failed-edits="failedEdits"
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
