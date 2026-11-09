<!-- The toasts of the user's edits that failed, for a `Toaster` (K1, K2): which edit, of which item, and why — "1 of 3 failed" for a change of several items — with the way to fix it on GitHub — refused by an organisation that has not approved githq, the way to request its approval (G5) — and a comment that was not posted back into its box unless it is there already. A change of several items that failed for some selects those alone in the list (⇧F, on the newest toast). Each shows until dismissed or for a while; dismissed, it leaves the status bar too, while one that only timed out stays there, and clicking that brings it back. A merge refused has a toast of its own (`MergeToasts`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowUpRight, Undo2 } from 'lucide-vue-next';

import type { Command } from '@/commands/CommandTypes.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { isMergeFailure } from '@/merge/isMergeFailure.js';
import { Browser } from '@/services/Browser.js';
import { getApprovalUrl } from '@/tracking/utils/getApprovalUrl.js';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';

import { CommentDrafts } from './CommentDrafts.js';
import { EditQueue } from './EditQueue.js';
import type { EditFailure } from './EditQueue.js';
import { useEditTexts } from './useEditTexts.js';
import * as l from './useEditTexts.loc.js';

/** The key selecting the failed items of a change of several — the list has no ⇧F of its own. */
const SELECT_FAILED_KEY = 'Shift+F';

const queue = useService(EditQueue);
const drafts = useService(CommentDrafts);
const navigation = useService(ItemNavigation);
const browser = useService(Browser);
const texts = useEditTexts();
const t = useTranslate();

function getCommands(failure: EditFailure): Command[] {
  return getFailedIds(failure).length > 0
    ? [
        {
          id: 'edits.selectFailed',
          title: t(l.selectFailedCommand),
          section: 'app',
          key: SELECT_FAILED_KEY,
          menu: false,
          run: () => selectFailed(failure),
        },
      ]
    : [];
}

/** The items that failed of a change of several (K2); none for a change of one item. */
function getFailedIds(failure: EditFailure): string[] {
  return failure.itemCount > 1 ? [...new Set(failure.failed.map(failed => failed.edit.itemId))] : [];
}

function selectFailed(failure: EditFailure) {
  navigation.requestSelection(getFailedIds(failure));
}

/** A comment that was not posted and is not in its box (it went back there unless something new was typed). */
function getUnrestoredComment(failure: EditFailure) {
  const edit = failure.failed[0]?.edit;
  if (edit?.subject.kind !== 'comment' || drafts.get(edit.itemId).includes(edit.subject.body)) {
    return null;
  }

  return { itemId: edit.itemId, body: edit.subject.body };
}

function restoreComment(failure: EditFailure) {
  const comment = getUnrestoredComment(failure);
  if (comment) {
    drafts.restore(comment.itemId, comment.body);
  }
}

/**
 * Where on GitHub what failed can be seen to or done by hand — or, refused by an organisation that has not approved
 * githq, where the user requests its approval (G5).
 */
function getLink(failure: EditFailure) {
  const [first] = failure.failed;
  if (!first) {
    return null;
  }

  if (first.reason.kind === 'organizationRestricted') {
    return { url: getApprovalUrl(browser.origin), text: t(l.requestAccess) };
  }

  const { edit } = first;

  const [repository = '', number = ''] = edit.reference.split('#');
  switch (edit.subject.kind) {
    case 'labelAdded':
    case 'labelRemoved':
      return { url: getGitHubUrl(`${repository}/labels`), text: t(l.openLabels) };
    case 'milestone':
      return { url: getGitHubUrl(`${repository}/milestones`), text: t(l.openMilestones) };
    default:
      // GitHub sends `/issues/N` on to a pull request's own address.
      return { url: getGitHubUrl(`${repository}/issues/${number}`), text: t(l.openOnGitHub) };
  }
}
</script>

<template>
  <template
    v-for="failure in queue.failures"
    :key="failure.id"
  >
    <Toast
      v-if="failure.toast && !isMergeFailure(failure)"
      :title="texts.failureTitle(failure)"
      :tone="failure.failed.length < failure.editCount ? 'warning' : 'danger'"
      lasts="long"
      :commands="getCommands(failure)"
      @update:open="queue.setToast(failure.id, $event)"
      @dismiss="queue.dismiss(failure.id)"
    >
      {{ texts.failureDetail(failure) }}
      <template #actions="{ active }">
        <Button
          v-if="getFailedIds(failure).length > 0"
          variant="secondary"
          size="sm"
          :kbd="active ? SELECT_FAILED_KEY : undefined"
          :keyshortcuts="active ? SELECT_FAILED_KEY : undefined"
          @click="selectFailed(failure)"
        >
          {{ t(l.selectFailed, { count: getFailedIds(failure).length }) }}
        </Button>
        <Button
          v-if="getUnrestoredComment(failure)"
          variant="secondary"
          size="sm"
          :icon="Undo2"
          @click="restoreComment(failure)"
        >
          {{ t(l.restoreComment) }}
        </Button>
        <Button
          v-if="getLink(failure)"
          variant="secondary"
          size="sm"
          :icon="ArrowUpRight"
          :link="getLink(failure)?.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ getLink(failure)?.text }}
        </Button>
      </template>
    </Toast>
  </template>
</template>
