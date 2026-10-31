<!-- `/settings/tracking/new`: choosing what to track on the first sign-in (G2, D20) — the user's own repositories and their open projects chosen at first, nothing of their organisations. "Track these" keeps the choice and goes on to the first download (G6); choosing nothing goes straight on to where the user was heading (`next`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { safeNextPath } from '@/auth/routeAccess.js';
import Button from '@/components/Button.vue';
import { Clock } from '@/services/Clock.js';

import { ApprovalRequests } from './ApprovalRequests.js';
import FirstSignInFrame from './FirstSignInFrame.vue';
import {
  getCandidateProjects,
  getCandidateRepositories,
  toTrackedProject,
  toTrackedRepository,
} from './trackingCandidates.js';
import TrackingChooser from './TrackingChooser.vue';
import * as l from './TrackingChoicePage.loc.js';
import { FIRST_DOWNLOAD_PATH } from './trackingRoutes.js';
import { TrackingStore } from './TrackingStore.js';
import type { CandidateProject, CandidateRepository, TrackingCandidates } from './TrackingTypes.js';

const auth = useService(AuthStore);
const tracking = useService(TrackingStore);
const approvals = useService(ApprovalRequests);
const clock = useService(Clock);
const route = useRoute();
const router = useRouter();
const t = useTranslate();

const candidates = shallowRef<TrackingCandidates | null>(null);
const failed = ref(false);
const repositories = ref<readonly string[]>([]);
const projects = ref<readonly string[]>([]);
const found = shallowRef<readonly (CandidateProject | CandidateRepository)[]>([]);
const now = clock.now();

const next = computed(() => safeNextPath(route.query.next));

onMounted(load);

async function load() {
  failed.value = false;
  const read = await tracking.loadCandidates();
  if (!read) {
    failed.value = true;
    return;
  }

  candidates.value = read;
  repositories.value = ownRepositories(read);
  // The user's own open projects, like their repositories.
  projects.value = read.projects.filter(project => !project.closed).map(project => project.id);
}

function ownRepositories(read: TrackingCandidates) {
  return read.repositories.repositories
    .filter(repository => !repository.isArchived)
    .map(repository => repository.nameWithOwner);
}

function addFound(candidate: CandidateProject | CandidateRepository) {
  found.value = [...found.value, candidate];
  if ('nameWithOwner' in candidate) {
    repositories.value = [...new Set([...repositories.value, candidate.nameWithOwner])];
  } else {
    projects.value = [...new Set([...projects.value, candidate.id])];
  }
}

async function trackOnlyMine() {
  if (candidates.value) {
    repositories.value = ownRepositories(candidates.value);
    projects.value = [];
  }

  await track();
}

async function track() {
  const read = candidates.value;
  const offered = read ? [...getCandidateRepositories(read), ...getCandidateProjects(read)] : [];
  const byKey = new Map<string, CandidateProject | CandidateRepository>();
  for (const candidate of [...offered, ...found.value]) {
    byKey.set('nameWithOwner' in candidate ? candidate.nameWithOwner : candidate.id, candidate);
  }

  const chosenRepositories = repositories.value.flatMap(name => {
    const candidate = byKey.get(name);
    return candidate && 'nameWithOwner' in candidate ? [toTrackedRepository(candidate)] : [];
  });
  const chosenProjects = projects.value.flatMap(id => {
    const candidate = byKey.get(id);
    return candidate && !('nameWithOwner' in candidate) ? [toTrackedProject(candidate)] : [];
  });

  tracking.choose({ repositories: chosenRepositories, projects: chosenProjects });
  if (chosenRepositories.length === 0 && chosenProjects.length === 0) {
    await router.replace(next.value ?? '/');
    return;
  }

  await router.push({ path: FIRST_DOWNLOAD_PATH, query: next.value ? { next: next.value } : {} });
}
</script>

<template>
  <FirstSignInFrame
    v-if="auth.viewer"
    :viewer="auth.viewer"
    step="choose"
  >
    <TrackingChooser
      v-if="candidates"
      v-model:repositories="repositories"
      v-model:projects="projects"
      :candidates="candidates"
      :now="now"
      :found="found"
      :approvals="approvals.requests"
      :find="tracking.findCandidate"
      @track="track"
      @only-mine="trackOnlyMine"
      @load-more="tracking.loadMoreRepositories"
      @request-approval="approvals.record"
      @found="addFound"
    />
    <div
      v-else
      :class="css.trackingChoicePage_status"
    >
      <template v-if="failed">
        <p role="alert">{{ t(l.failed) }}</p>
        <div :class="css.trackingChoicePage_actions">
          <Button
            variant="primary"
            @click="load"
          >
            {{ t(l.retry) }}
          </Button>
          <Button @click="track">{{ t(l.skip) }}</Button>
        </div>
      </template>
      <p
        v-else
        role="status"
      >
        {{ t(l.reading) }}
      </p>
    </div>
  </FirstSignInFrame>
</template>

<style lang="scss" module="css">
.trackingChoicePage_status {
  display: flex;
  flex-direction: column;
  gap: $spacing-16;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  font-size: $font-size-md;
  color: $color-fg-2;
}

.trackingChoicePage_actions {
  display: flex;
  gap: $spacing-10;
}
</style>
