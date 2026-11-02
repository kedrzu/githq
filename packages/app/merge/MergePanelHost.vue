<!-- The merge panel as the app shows it, mounted once over every screen (merging D7): open for the pull request `MergePanelStore` names, fed by the stores — the pull request as the local copy holds it, its row or the detail of one opened from outside the lists, the repository's merge settings, the viewer's permission — and the read it starts on opening (`useMergeOptions`), and merging through the store, which keeps what the session knows of a merge that did not end merged; its steps towards the merge — GitHub's conflict editor, marking it ready, updating its branch (`ItemEditor`) — read the pull request again once done. Each opening is a fresh panel. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, shallowRef, watch } from 'vue';

import { ItemEditor } from '@/edits/ItemEditor.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { useNow } from '@/services/useNow.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { pause } from '@/utils/pause.js';

import MergePanel from './MergePanel.vue';
import { getConflictEditorUrl } from './getConflictEditorUrl.js';
import { MergePanelStore } from './MergePanelStore.js';
import type { MergeStep, MergeSubmission } from './MergeTypes.js';
import { useMergeOptions } from './useMergeOptions.js';

/** How often a running check's time moves on. */
const TICK_MS = 1000;
/** The first wait before reading again whether an update of the branch landed; each next one doubles. */
const FIRST_UPDATE_READ_MS = 1000;
/** How long the panel waits for an update of the branch to land before it shows what GitHub says. */
const UPDATE_TIME_LIMIT_MS = 30_000;

const store = useService(MergePanelStore);
const details = useService(ItemDetailStore);
const repositories = useService(RepositoryStore);
const editor = useService(ItemEditor);
const browser = useService(Browser);
const clock = useService(Clock);

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
/** GitHub said at once the merge sent merged: it was merged already (PM30). */
const alreadyMerged = shallowRef(false);
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
    alreadyMerged.value = false;
  },
);
watch(repository, name => {
  if (name !== null) {
    void repositories.ensure(name);
  }
});

/**
 * Busy until GitHub answered — and, refused, until the panel read the pull request again, so it shows what the refusal
 * is told apart by (PM27, PM28).
 */
async function merge(submission: MergeSubmission) {
  const item = pr.value;
  if (!item) {
    return;
  }

  const opening = store.opening;
  sending.value = true;
  const answer = await store.merge({ item, submission });
  if (answer.kind === 'refused' && store.opening === opening) {
    await read.refresh();
  }

  // Opened anew meanwhile: that panel is not this one's to answer.
  if (store.opening === opening) {
    sending.value = false;
    alreadyMerged.value = answer.kind === 'merged';
  }
}

/**
 * A step towards the merge (merging D12): the conflicts leave for GitHub's editor; marking it ready and updating its
 * branch are edits like any other — a refusal is reported as a failed edit — after which the panel reads the pull
 * request again, and merging comes back when GitHub says so (PM20, PM21). The step is no news of the last merge: what
 * the session knew of it stops speaking (`forget`).
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
  const head = item.headRefOid;
  advancing.value = step;
  store.forget(item.id);
  const outcome = await editor.edit(
    [item.id],
    step === 'markReady' ? { kind: 'draft', draft: false } : { kind: 'updateBranch', method: 'MERGE' },
  );
  await read.refresh();
  if (step === 'updateBranch' && outcome.failed.length === 0) {
    await waitForNewHead(item.id, opening, head);
  }

  // Opened anew meanwhile: that panel is not this one's to answer.
  if (store.opening === opening) {
    advancing.value = null;
  }
}

/**
 * GitHub answers an update of the branch before it is made: the old head, its mergeability unknown (live,
 * 2026-11-02). Merging that head would be refused as a new commit, so the panel stays updating and reads the pull
 * request again, waiting longer each time, until the head moved — or the panel is opened anew, or the time is up:
 * then what GitHub says goes.
 */
async function waitForNewHead(itemId: string, opening: number, head: string) {
  const deadline = clock.now() + UPDATE_TIME_LIMIT_MS;
  let delay = FIRST_UPDATE_READ_MS;
  while (isShown() && pr.value?.headRefOid === head && clock.now() < deadline) {
    await pause(clock, Math.min(delay, deadline - clock.now()));
    delay *= 2;
    if (!isShown()) {
      return;
    }

    await read.refresh();
  }

  function isShown() {
    return store.opening === opening && store.itemId === itemId;
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
    :record="sending ? null : store.getRecord(pr.id)"
    :sent="store.getSent(pr.id)"
    :already-merged="alreadyMerged"
    :advancing="advancing"
    :now="now"
    @merge="merge"
    @step="takeStep"
    @visit="browser.openInNewTab"
  />
</template>
