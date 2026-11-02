<!-- The merge panel as the app shows it, mounted once over every screen (merging D7): open for the pull request `MergePanelStore` names, fed by the stores — the pull request as the local copy holds it, its row or the detail of one opened from outside the lists, the repository's merge settings, the viewer's permission — and the read it starts on opening (`useMergeOptions`), and merging through the store. Each opening is a fresh panel. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, shallowRef, watch } from 'vue';

import type { EditFailureReason } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { useNow } from '@/services/useNow.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';

import MergePanel from './MergePanel.vue';
import { MergePanelStore } from './MergePanelStore.js';
import type { MergeRequest } from './MergeTypes.js';
import { useMergeOptions } from './useMergeOptions.js';

/** How often a running check's time moves on. */
const TICK_MS = 1000;

const store = useService(MergePanelStore);
const details = useService(ItemDetailStore);
const repositories = useService(RepositoryStore);
const editor = useService(ItemEditor);

const pr = computed(() => {
  const id = store.itemId;
  const item = id === null ? undefined : details.getItem(id);
  return item?.kind === 'pullRequest' ? item : null;
});
const read = useMergeOptions({ itemId: () => store.itemId });
const repository = computed(() => pr.value?.repository.nameWithOwner ?? null);
const settings = computed(() => (repository.value === null ? null : (repositories.get(repository.value) ?? null)));
const sending = shallowRef(false);
const refusal = shallowRef<EditFailureReason | null>(null);
const now = useNow(TICK_MS, () => pr.value !== null);

const open = computed({
  get: () => pr.value !== null,
  set: (value: boolean) => {
    if (!value) {
      store.close();
    }
  },
});

// Each opening starts clean; the repository's settings are read when not in memory, or old.
watch(
  () => store.opening,
  () => {
    sending.value = false;
    refusal.value = null;
  },
);
watch(repository, name => {
  if (name !== null) {
    void repositories.ensure(name);
  }
});

async function merge(request: MergeRequest) {
  const item = pr.value;
  if (!item) {
    return;
  }

  const opening = store.opening;
  sending.value = true;
  refusal.value = null;
  const answer = await store.merge(item, request);
  // Opened anew meanwhile: that panel is not this one's to answer.
  if (store.opening !== opening) {
    return;
  }

  sending.value = false;
  if (answer.kind === 'refused') {
    refusal.value = answer.reason;
  }
}
</script>

<template>
  <MergePanel
    v-if="pr"
    :key="store.opening"
    v-model:open="open"
    :pr="pr"
    :settings="settings"
    :options="read.options"
    :reading="read.reading"
    :allowed="editor.getPermissions(pr).mergePanel"
    :sending="sending"
    :refusal="refusal"
    :now="now"
    @merge="merge"
  />
</template>
