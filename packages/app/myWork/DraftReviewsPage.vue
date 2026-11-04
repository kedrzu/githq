<!-- `/pulls/drafts` (code review D28, CR34): the pull requests of the local copy with the viewer's draft review. The selection and the walk through them are every list's (`useItemList`); a row opens its review, the draft being on it, and `⇧S` opens the selected one's at its submit dialog. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { Send } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { useCommands } from '@/commands/useCommands.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { formatItemReference, getItemReference, getReviewPath } from '@/item/itemRoutes.js';
import ItemContextMenu from '@/lists/ItemContextMenu.vue';
import SelectionActions from '@/lists/SelectionActions.vue';
import { useItemList } from '@/lists/useItemList.js';
import { ItemStore } from '@/store/ItemStore.js';

import DraftReviewsView from './DraftReviewsView.vue';
import * as l from './DraftReviewsView.loc.js';
import { getDraftReviews } from './getDraftReviews.js';

const auth = useService(AuthStore);
const items = useService(ItemStore);
const router = useRouter();
const list = useItemList();
const navigation = useService(ItemNavigation);
const t = useTranslate();

const drafts = computed(() => getDraftReviews(items.all));

useCommands(() => [
  {
    id: 'draftReviews.submit',
    title: t(l.submit),
    section: 'view',
    key: 'Shift+S',
    icon: Send,
    actsOnRow: true,
    when: () => list.selectedId !== null,
    run: () => {
      if (list.selectedId !== null) {
        const item = items.get(list.selectedId);
        if (item) {
          navigation.noteReviewSubmit(formatItemReference(getItemReference(item)));
        }

        open(list.selectedId);
      }
    },
  },
]);

function open(id: string) {
  const item = items.get(id);
  if (item) {
    void router.push(getReviewPath(getItemReference(item)));
  }
}
</script>

<template>
  <DraftReviewsView
    v-if="auth.viewer"
    v-model:selected-id="list.selectedId"
    v-model:checked-ids="list.checkedIds"
    :drafts="drafts"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :undone="list.undone"
    @open="open"
    @listed="list.setListed"
  >
    <template #selection="{ ids, span }">
      <SelectionActions
        :ids="ids"
        :span="span"
        @clear="list.checkedIds = []"
      />
    </template>
    <template #contextMenu="menu">
      <ItemContextMenu
        :ids="menu.ids"
        :merge="menu.merge"
        @open="menu.open"
      />
    </template>
  </DraftReviewsView>
</template>
