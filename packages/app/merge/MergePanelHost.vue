<!-- The merge panel as the app shows it, mounted once over every screen (merging D7): open for the pull request `MergePanelStore` names, fed by the stores — the pull request as the local copy holds it, its row or the detail of one opened from outside the lists, the repository's merge settings, the viewer's permission — and the read it starts on opening (`useMergeOptions`), and merging through the store, which keeps what the session knows of a merge that did not end merged; its steps towards the merge — GitHub's conflict editor, marking it ready, updating its branch (`ItemEditor`) — read the pull request again once done. Each opening is a fresh panel. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, shallowRef, watch } from 'vue';

import { ItemEditor } from '@/edits/ItemEditor.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { useNow } from '@/services/useNow.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';

import MergePanel from './MergePanel.vue';
import { getConflictEditorUrl } from './getConflictEditorUrl.js';
import { MergePanelStore } from './MergePanelStore.js';
import type { MergeStep, MergeSubmission } from './MergeTypes.js';
import { useMergeOptions } from './useMergeOptions.js';

/** How often a running check's time moves on. */
const TICK_MS = 1000;

const store = useService(MergePanelStore);
const details = useService(ItemDetailStore);
const repositories = useService(RepositoryStore);
const editor = useService(ItemEditor);
const browser = useService(Browser);

const pr = computed(() => {
  const id = store.itemId;
  const item = id === null ? undefined : details.getItem(id);
  return item?.kind === 'pullRequest' ? item : null;
});
const read = useMergeOptions({ itemId: () => store.itemId });
const repository = computed(() => pr.value?.repository.nameWithOwner ?? null);
const settings = computed(() => (repository.value === null ? null : (repositories.get(repository.value) ?? null)));
const sending = shallowRef(false);
const advancing = shallowRef<MergeStep | null>(null);
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
    advancing.value = null;
  },
);
watch(repository, name => {
  if (name !== null) {
    void repositories.ensure(name);
  }
});

/** Busy until GitHub answered and a refusal is told apart — by the panel's own read again, so it shows it (PM27). */
async function merge(submission: MergeSubmission) {
  const item = pr.value;
  if (!item) {
    return;
  }

  const opening = store.opening;
  sending.value = true;
  await store.merge({ item, submission, reread });
  // Opened anew meanwhile: that panel is not this one's to answer.
  if (store.opening === opening) {
    sending.value = false;
  }
}

async function reread() {
  await read.refresh();
  return read.options;
}

/**
 * A step towards the merge (merging D12): the conflicts leave for GitHub's editor; marking it ready and updating its
 * branch are edits like any other — a refusal is reported as a failed edit — after which the panel reads the pull
 * request again, and merging comes back when GitHub says so (PM20, PM21).
 */
async function takeStep(step: MergeStep) {
  const item = pr.value;
  if (!item) {
    return;
  }

  if (step === 'resolveConflicts') {
    browser.openInNewTab(getConflictEditorUrl(item));
    return;
  }

  const opening = store.opening;
  advancing.value = step;
  await editor.edit(
    [item.id],
    step === 'markReady' ? { kind: 'draft', draft: false } : { kind: 'updateBranch', method: 'MERGE' },
  );
  await read.refresh();
  // Opened anew meanwhile: that panel is not this one's to answer.
  if (store.opening === opening) {
    advancing.value = null;
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
    :record="store.getRecord(pr.id)"
    :advancing="advancing"
    :now="now"
    @merge="merge"
    @step="takeStep"
    @visit="browser.openInNewTab"
  />
</template>
