<!-- The toasts of the issues just created from the new issue form, for the shell's `Toaster` (mobile D44): one per issue in `NewIssueComposer.created`, with its number once GitHub gave it (the item store's issue). Create another opens the form again with the issue's repository, project and labels; Open opens the issue as lists do (`useOpenItem`) — pressed before the number, once it comes. Either closes the toast, and so does a creation GitHub refused (the form comes back with its reason, H9). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { shallowRef, watch } from 'vue';

import { useOpenItem } from '@/item/useOpenItem.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import { ItemStore } from '@/store/ItemStore.js';

import IssueCreatedToast from './IssueCreatedToast.vue';
import { NewIssueComposer } from './NewIssueComposer.js';
import type { NewIssueCreated } from './NewIssueComposer.js';

const composer = useService(NewIssueComposer);
const items = useService(ItemStore);
const openItem = useOpenItem();

/** The created issues whose Open was pressed before GitHub gave their number, by id. */
const opening = shallowRef<ReadonlySet<number>>(new Set());

// An issue whose Open waits opens as soon as GitHub's issue is in.
watch(
  () => composer.created.filter(entry => opening.value.has(entry.id) && getIssue(entry) !== null),
  ready => {
    for (const entry of ready) {
      open(entry);
    }
  },
);

function open(entry: NewIssueCreated) {
  const issue = getIssue(entry);
  if (issue === null) {
    opening.value = new Set([...opening.value, entry.id]);
    return;
  }

  openItem(issue);
  forget(entry);
}

function createAnother(entry: NewIssueCreated) {
  composer.startAnother(entry.id);
  forget(entry);
}

function forget(entry: NewIssueCreated) {
  opening.value = new Set([...opening.value].filter(id => id !== entry.id));
  composer.forgetCreated(entry.id);
}

/** GitHub's issue, once it answered with one. */
function getIssue(entry: NewIssueCreated) {
  const issue = entry.issueId === null ? undefined : items.get(entry.issueId);
  return issue && !isPendingItem(issue) ? issue : null;
}
</script>

<template>
  <IssueCreatedToast
    v-for="entry in composer.created"
    :key="entry.id"
    :repository="entry.repository"
    :title="entry.title"
    :number="getIssue(entry)?.number ?? null"
    :opening="opening.has(entry.id)"
    :offer-another="!composer.open"
    @create-another="createAnother(entry)"
    @open="open(entry)"
    @update:open="$event || forget(entry)"
  />
</template>
