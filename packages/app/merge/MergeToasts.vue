<!-- The toasts of merges the user moved on from, for a `Toaster` (merging D15): a merge GitHub refused is a failed edit (K1) — the same toast and status bar — that stays until dismissed, says nothing merged and leads back to the merge panel with the edited text (`⌥M`, PM35) — refused by an organisation that has not approved githq, it says so and links to requesting access (G5); a merge GitHub confirmed while the panel did not show it says so, small and quiet, and goes by itself (PM34). Both act on their own pull request, never on the row selected: `⌥M`, not `⇧M`. No answer in time has no toast (PM36). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowUpRight, GitMerge } from 'lucide-vue-next';
import { computed } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import type { EditFailure } from '@/edits/EditQueue.js';
import { EditQueue } from '@/edits/EditQueue.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import { Browser } from '@/services/Browser.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { getApprovalUrl } from '@/tracking/utils/getApprovalUrl.js';

import { isMergeFailure } from './isMergeFailure.js';
import { MergeContext } from './MergeContext.js';
import { MergePanelStore } from './MergePanelStore.js';
import * as l from './MergeToasts.loc.js';

/** How long the toast of a merge confirmed stays: a few seconds (PM34). */
const CONFIRMED_MS = 5000;
/** The key back to the merge panel of a refused merge: the toast's own, as `⇧M` is the selected row's (D15). */
const BACK_KEY = 'Alt+M';

const queue = useService(EditQueue);
const store = useService(MergePanelStore);
const details = useService(ItemDetailStore);
const browser = useService(Browser);
const merging = injectContext(MergeContext, { optional: true });
const texts = useEditTexts();
const t = useTranslate();

/** The merges refused, listed until dismissed, with the pull request each is about. */
const refusals = computed(() =>
  queue.failures.flatMap(failure => {
    const edit = failure.failed[0]?.edit;
    return edit && isMergeFailure(failure) ? [{ failure, itemId: edit.itemId }] : [];
  }),
);

useCommands(() => [
  {
    id: 'merge.backToMerge',
    title: t(l.backToMergeCommand),
    section: 'app',
    key: BACK_KEY,
    menu: false,
    when: () => findLatest() !== undefined,
    run: () => {
      const latest = findLatest();
      if (latest) {
        backToMerge(latest.failure, latest.itemId);
      }
    },
  },
]);

/** The latest refusal showing that leads back to the panel. */
function findLatest() {
  return refusals.value.findLast(({ failure, itemId }) => failure.toast && canGoBack(itemId));
}

function canGoBack(itemId: string) {
  return merging?.canOpen(itemId) === true;
}

/** The panel again, for the pull request refused — not the row selected — with the text sent (D15); the toast goes. */
function backToMerge(failure: EditFailure, itemId: string) {
  queue.dismiss(failure.id);
  merging?.open(itemId);
}

/** The pull request on GitHub — or, refused by an organisation that has not approved githq, where to request it (G5). */
function getLink(failure: EditFailure, itemId: string) {
  if (failure.failed[0]?.reason.kind === 'organizationRestricted') {
    return { url: getApprovalUrl(browser.origin), text: t(l.requestAccess) };
  }

  const url = details.getItem(itemId)?.url;
  return url ? { url, text: t(l.openOnGitHub) } : null;
}
</script>

<template>
  <template
    v-for="{ failure, itemId } in refusals"
    :key="`refused-${failure.id}`"
  >
    <Toast
      v-if="failure.toast"
      :title="texts.failureTitle(failure)"
      :duration="Number.POSITIVE_INFINITY"
      @update:open="queue.setToast(failure.id, $event)"
      @dismiss="queue.dismiss(failure.id)"
    >
      {{ texts.failureDetail(failure) }}
      <template #actions>
        <Button
          v-if="canGoBack(itemId)"
          variant="primary"
          size="sm"
          :icon="GitMerge"
          :kbd="BACK_KEY"
          :aria-keyshortcuts="BACK_KEY"
          @click="backToMerge(failure, itemId)"
        >
          {{ t(l.backToMerge) }}
        </Button>
        <Button
          v-if="getLink(failure, itemId)"
          variant="secondary"
          size="sm"
          :icon="ArrowUpRight"
          :link="getLink(failure, itemId)?.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ getLink(failure, itemId)?.text }}
        </Button>
      </template>
    </Toast>
  </template>
  <Toast
    v-for="confirmation in store.confirmations"
    :key="`merged-${confirmation.id}`"
    :title="t(l.merged, { reference: confirmation.reference, base: confirmation.base })"
    tone="done"
    :duration="CONFIRMED_MS"
    @update:open="!$event && store.dismissConfirmation(confirmation.id)"
  />
</template>
