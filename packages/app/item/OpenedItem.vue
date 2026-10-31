<!-- The item an address opens, in its arrangement (D9): found and kept current (`useOpenedItem`), shown in the item view — in a dialog for `modal` — and moved through. `K`/`J` step through the list it was opened from, the switch moves it to another arrangement (remembered as the one to open in next), and closing goes back to the list, where it stays selected. Moving to another item or arrangement replaces the address; opening a linked item or closing adds one, so Back returns. -->
<script lang="ts" setup>
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useLogger } from '@nzyme/vue-ioc/useLogger.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { SearchX } from 'lucide-vue-next';
import { computed, watch } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import { CommentDrafts } from '@/edits/CommentDrafts.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { AuthStore } from '@/auth/AuthStore.js';
import { useNow } from '@/services/useNow.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import type { Item } from '@/store/ItemTypes.js';

import type { ItemEditing } from './ItemEditing.js';
import { ItemNavigation } from './ItemNavigation.js';
import { getItemPagePath, getItemReference, getOpenedItemQuery } from './itemRoutes.js';
import type { ItemArrangement, ItemReference } from './itemRoutes.js';
import ItemView from './ItemView.vue';
import * as l from './OpenedItem.loc.js';
import { useOpenedItem } from './useOpenedItem.js';

const props = defineProps<{
  reference: ItemReference;
  arrangement: ItemArrangement;
}>();

/** How often the ages ("2h") move on. */
const TICK_MS = 30_000;

const t = useTranslate();
const logger = useLogger();
const details = useService(ItemDetailStore);
const navigation = useService(ItemNavigation);
const editor = useService(ItemEditor);
const repositories = useService(RepositoryStore);
const auth = useService(AuthStore);
const drafts = useService(CommentDrafts);
const route = useRoute();
const router = useRouter();

const opened = useOpenedItem({ reference: () => props.reference });
const now = useNow(TICK_MS);

const referenceText = computed(() => `${props.reference.owner}/${props.reference.name}#${props.reference.number}`);
const position = computed(() => {
  const ids = navigation.list?.ids ?? [];
  const index = opened.id === null ? -1 : ids.indexOf(opened.id);
  return index === -1 ? null : { index: index + 1, count: ids.length };
});
const closes = computed((): Item[] => {
  const { item } = opened;
  if (item?.kind !== 'pullRequest') {
    return [];
  }

  return mapNotNull(item.closingIssueIds, id => details.getItem(id));
});

// The comment box holds the opened item's draft: it stays with the item while the user moves on, and a comment
// GitHub did not take comes back into it.
const commentDraft = computed({
  get: () => (opened.id === null ? '' : drafts.get(opened.id)),
  set: (text: string) => {
    if (opened.id !== null) {
      drafts.set(opened.id, text);
    }
  },
});

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

function step(delta: 1 | -1) {
  const ids = navigation.list?.ids ?? [];
  const index = opened.id === null ? -1 : ids.indexOf(opened.id);
  const target = index === -1 ? undefined : ids[index + delta];
  const item = target === undefined ? undefined : details.getItem(target);
  if (item) {
    void router.replace(locate(getItemReference(item), props.arrangement, item.kind));
  }
}

function arrange(arrangement: ItemArrangement) {
  navigation.setArrangement(arrangement);
  void router.replace(locate(props.reference, arrangement, opened.item?.kind));
}

function open(reference: ItemReference) {
  void router.push(locate(reference, props.arrangement));
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
  return { path: list.path, query: getOpenedItemQuery(list.query, reference, arrangement) };
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

function loadViewerProjects() {
  void repositories.ensureViewerProjects();
}

async function loadAllComments() {
  const { id } = opened;
  if (id === null) {
    return;
  }

  try {
    // 100 at a time, until none are left — or the detail was read again meanwhile and the cursor did not move.
    let cursor = details.get(id)?.comments.olderCursor ?? null;
    while (cursor !== null) {
      await details.loadOlderComments(id);
      const next = details.get(id)?.comments.olderCursor ?? null;
      cursor = next === cursor ? null : next;
    }
  } catch (error) {
    logger.warn('Older comments could not be read', { id, error });
  }
}
</script>

<template>
  <Dialog
    v-if="arrangement === 'modal'"
    :open="true"
    :title="opened.item?.title ?? referenceText"
    :width="1100"
    bare
    @update:open="close"
  >
    <ItemView
      v-if="opened.item"
      v-model:comment-draft="commentDraft"
      :item="opened.item"
      :detail="opened.detail"
      arrangement="modal"
      :position="position"
      :closes="closes"
      :now="now"
      :load-all-comments="loadAllComments"
      :editing="editing"
      @edit="edit"
      @need-projects="loadViewerProjects"
      @close="close"
      @previous="step(-1)"
      @next="step(1)"
      @arrange="arrange"
      @open="open"
    />
    <EmptyState
      v-else
      :icon="SearchX"
      :title="opened.missing ? t(l.missing) : t(l.opening, { reference: referenceText })"
      :detail="opened.missing ? t(l.missingDetail, { reference: referenceText }) : undefined"
    />
  </Dialog>
  <ItemView
    v-else-if="opened.item"
    v-model:comment-draft="commentDraft"
    :item="opened.item"
    :detail="opened.detail"
    :arrangement="arrangement"
    :position="position"
    :closes="closes"
    :now="now"
    :load-all-comments="loadAllComments"
    :editing="editing"
    @edit="edit"
    @need-projects="loadViewerProjects"
    @close="close"
    @previous="step(-1)"
    @next="step(1)"
    @arrange="arrange"
    @open="open"
  />
  <div
    v-else
    :class="css.openedItem_waiting"
  >
    <EmptyState
      :icon="SearchX"
      :title="opened.missing ? t(l.missing) : t(l.opening, { reference: referenceText })"
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
  background: $color-bg-2;
}
</style>
