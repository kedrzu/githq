<!-- `/` and a group's own list at GitHub's dashboard address of it (`/pulls/review-requested`, `/pulls`, `/issues/assigned`, `/issues/mentioned`; `myWorkRoutes.ts`): "my work" from the local copy (D11, D17) — all four groups, or the one the sidebar narrowed it to (`meta.myWorkGroup`). The routes share one instance (`meta.key`), so the filter and the selection survive moving between them. Opening items and the selection are every list's (`useItemList`); the layout, order and properties shown are kept on this device (`useListViewOptions`). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import ItemContextMenu from '@/lists/ItemContextMenu.vue';
import SelectionActions from '@/lists/SelectionActions.vue';
import { useItemList } from '@/lists/useItemList.js';
import { useListViewOptions } from '@/lists/useListViewOptions.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import { ItemStore } from '@/store/ItemStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import type { MyWorkFilter } from './buildMyWork.js';
import { buildMyWork } from './buildMyWork.js';
import MyWorkView from './MyWorkView.vue';
import { MY_WORK_VIEW_CHOICES, MY_WORK_VIEW_DEFAULTS } from './myWorkViewOptions.js';

const auth = useService(AuthStore);
const items = useService(ItemStore);
const projects = useService(ProjectStore);
const tracking = useService(TrackingStore);
const route = useRoute();
const list = useItemList();
const view = useListViewOptions({ list: 'myWork', defaults: MY_WORK_VIEW_DEFAULTS, choices: MY_WORK_VIEW_CHOICES });

const filter = ref<MyWorkFilter>('all');
const trackedRepositories = computed(() => tracking.repositories.map(repository => repository.nameWithOwner));

const group = computed(() => route.meta.myWorkGroup ?? null);
// D12: each row's projects as lists outside them show them — the tracked ones first, with their row field.
const work = computed(() =>
  buildMyWork({
    membership: items.membership,
    getItem: id => {
      const item = items.get(id);
      return item && projects.withRowFields(item);
    },
    filter: filter.value,
    sort: view.options.sort,
  }),
);
// "Needs me" empty points at the user's open pull requests waiting on others, nested ones included.
const waitingCount = computed(() => {
  if (filter.value !== 'needsMe') {
    return 0;
  }

  let count = 0;
  for (const id of items.membership.authored ?? []) {
    const item = items.get(id);
    if (item?.kind === 'pullRequest' && item.state === 'OPEN' && getPullRequestStanding(item).waitingOnOthers) {
      count++;
    }
  }

  return count;
});
</script>

<template>
  <MyWorkView
    v-if="auth.viewer"
    v-model:filter="filter"
    v-model:selected-id="list.selectedId"
    v-model:checked-ids="list.checkedIds"
    :options="view.options"
    :modified="view.modified"
    :work="work"
    :group="group"
    :viewer-login="auth.viewer.login"
    :now="list.now"
    :waiting-count="waitingCount"
    :tracked-repositories="trackedRepositories"
    :opened-id="list.openedId"
    :undone="list.undone"
    @update:options="view.set($event)"
    @reset="view.reset()"
    @open="list.open"
    @listed="list.setListed"
  >
    <template #selection="{ ids }">
      <SelectionActions
        :ids="ids"
        @clear="list.checkedIds = []"
      />
    </template>
    <template #contextMenu="menu">
      <ItemContextMenu
        :ids="menu.ids"
        @open="menu.open"
      />
    </template>
  </MyWorkView>
</template>
