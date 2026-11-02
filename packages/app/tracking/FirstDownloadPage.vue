<!-- `/settings/tracking/download`: the first download (G6, D20) of what the user chose — "Open My work" as soon as their own work is in, then on to where they were heading (`next`). The download is the sync engine's: leaving this page, or closing the tab, stops nothing (it resumes in the next session). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { safeNextPath } from '@/auth/routeAccess.js';
import { buildMyWork } from '@/myWork/buildMyWork.js';
import { Clock } from '@/services/Clock.js';
import { ItemStore } from '@/store/ItemStore.js';
import { groupStacks } from '@/store/stacks/groupStacks.js';

import FirstDownloadView from './FirstDownloadView.vue';
import type { FirstDownloadOverall, FirstDownloadRow } from './FirstDownloadView.vue';
import FirstSignInFrame from './FirstSignInFrame.vue';
import { getCandidateRepositories } from './trackingCandidates.js';
import { TrackingStore } from './TrackingStore.js';

/** The pace is told only after this long, so a first page read at once does not promise seconds. */
const PACE_AFTER_MS = 5000;

const auth = useService(AuthStore);
const items = useService(ItemStore);
const tracking = useService(TrackingStore);
const clock = useService(Clock);
const route = useRoute();
const router = useRouter();

const myWork = computed(() =>
  items.getSyncState('myWork').lastSuccessAt === null
    ? null
    : buildMyWork({
        membership: items.membership,
        getItem: id => items.get(id),
        stacks: groupStacks(items.all),
        filter: 'all',
        sort: 'updated',
      }).counts,
);

const rows = computed((): FirstDownloadRow[] => {
  const candidates = tracking.candidates;
  const privateRepositories = new Set<string>();
  for (const repository of candidates ? getCandidateRepositories(candidates) : []) {
    if (repository.isPrivate) {
      privateRepositories.add(repository.nameWithOwner);
    }
  }

  return [
    ...tracking.repositories.map((repository): FirstDownloadRow => ({
      kind: 'repository',
      key: `repository:${repository.nameWithOwner}`,
      name: repository.nameWithOwner,
      isPrivate: privateRepositories.has(repository.nameWithOwner),
      progress: tracking.getProgress({ kind: 'repository', nameWithOwner: repository.nameWithOwner }),
    })),
    ...tracking.projects.map((project): FirstDownloadRow => ({
      kind: 'project',
      key: `project:${project.id}`,
      name: project.title,
      isPrivate: false,
      progress: tracking.getProgress({ kind: 'project', id: project.id }),
    })),
    ...(candidates?.organizations ?? [])
      .filter(organization => organization.hiddenPrivate)
      .map((organization): FirstDownloadRow => ({
        kind: 'organization',
        key: `organization:${organization.login}`,
        name: organization.login,
      })),
  ];
});

const progress = computed(() => {
  let done = 0;
  let total: number | null = 0;
  let finished = true;
  for (const row of rows.value) {
    if (row.kind === 'organization' || row.progress.state === 'hidden') {
      continue;
    }

    done += row.progress.done;
    total = total === null || row.progress.total === null ? null : total + row.progress.total;
    finished &&= row.progress.state === 'done';
  }

  return { done, total, finished };
});

// The pace so far, from what had arrived when the page opened.
const start = { at: clock.now(), done: progress.value.done };
const overall = computed((): FirstDownloadOverall => {
  const { done, total, finished } = progress.value;
  const elapsed = clock.now() - start.at;
  const pace = elapsed >= PACE_AFTER_MS ? (done - start.done) / elapsed : 0;
  return {
    done,
    total,
    finished,
    secondsLeft: total !== null && pace > 0 ? Math.max(1, Math.round((total - done) / pace / 1000)) : null,
  };
});

function open() {
  void router.push(safeNextPath(route.query.next) ?? '/');
}
</script>

<template>
  <FirstSignInFrame
    v-if="auth.viewer"
    :viewer="auth.viewer"
    step="download"
  >
    <FirstDownloadView
      :my-work="myWork"
      :rows="rows"
      :overall="overall"
      @open="open"
    />
  </FirstSignInFrame>
</template>
