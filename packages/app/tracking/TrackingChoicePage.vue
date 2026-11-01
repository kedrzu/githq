<!-- `/settings/tracking/new`: choosing what to track on the first sign-in (G2, D20) — the user's own repositories and their open projects chosen at first, nothing of their organisations. "Track these" keeps the choice and goes on to the first download (G6); choosing nothing goes straight on to where the user was heading (`next`). While the candidates are read, it looks for settings saved to GitHub (settings-sync D3): found, it offers to load them instead (G11); otherwise the choice offers saving them, unticked (G2), and ticked, "Track these" creates the repository (G12). Declined (G13), or in a repository githq can't use (G14), one line says so instead. Nothing is created on GitHub unless the box is ticked, and a file found is loaded only on the user's word; a look that fails never holds the sign-in up. -->
<script lang="ts" setup>
import { SETTINGS_REPOSITORY_NAME } from '@githq/github/settings/getSettingsRepository.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { safeNextPath } from '@/auth/routeAccess.js';
import Button from '@/components/Button.vue';
import SavedSettingsNotLoaded from '@/settings/SavedSettingsNotLoaded.vue';
import SavedSettingsOffer from '@/settings/SavedSettingsOffer.vue';
import SavingChoice from '@/settings/SavingChoice.vue';
import type { StoppedReason } from '@/settings/sync/SettingsSaving.js';
import { SettingsSync } from '@/settings/sync/SettingsSync.js';
import type { FoundSettings, NoSettings } from '@/settings/sync/SettingsSync.js';
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
import type { TrackingChoice } from './TrackingStore.js';
import { TrackingStore } from './TrackingStore.js';
import type { CandidateProject, CandidateRepository, TrackingCandidates } from './TrackingTypes.js';

/**
 * What the user's account holds for saving, as the page last looked: still looking; settings found, offered (G11);
 * none, so saving is offered (G2) — `inspection` `null` when the look failed; the settings found declined (G13); a
 * repository that can't be used (G14).
 */
type SavedSettings =
  | { readonly kind: 'looking' | 'declined' }
  | { readonly kind: 'found'; readonly found: FoundSettings }
  | { readonly kind: 'none'; readonly inspection: NoSettings | null }
  | { readonly kind: 'unusable'; readonly reason: StoppedReason };

const auth = useService(AuthStore);
const tracking = useService(TrackingStore);
const sync = useService(SettingsSync);
const approvals = useService(ApprovalRequests);
const clock = useService(Clock);
const logger = useService(Logger);
const route = useRoute();
const router = useRouter();
const t = useTranslate();

const candidates = shallowRef<TrackingCandidates | null>(null);
const failed = ref(false);
const repositories = ref<readonly string[]>([]);
const projects = ref<readonly string[]>([]);
const found = shallowRef<readonly (CandidateProject | CandidateRepository)[]>([]);
const saved = shallowRef<SavedSettings>({ kind: 'looking' });
/** The box to save what is tracked to GitHub (G2, G12). */
const save = ref(false);
/** GitHub is asked what saving would meet: the box stays still, and "Track these" waits. */
const looking = ref(false);
const now = clock.now();

const next = computed(() => safeNextPath(route.query.next));
const settingsRepository = computed(() =>
  auth.viewer ? `${auth.viewer.login}/${SETTINGS_REPOSITORY_NAME}` : SETTINGS_REPOSITORY_NAME,
);
const privateRepositories = computed(
  () =>
    new Set(
      candidates.value
        ? getCandidateRepositories(candidates.value)
            .filter(repository => repository.isPrivate)
            .map(repository => repository.nameWithOwner)
        : [],
    ),
);

onMounted(() => {
  void lookForSaved();
  void load();
});

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

/** Looks once for settings saved to GitHub; a look that fails offers saving, which looks again when it is ticked. */
async function lookForSaved() {
  saved.value = (await inspect()) ?? { kind: 'none', inspection: null };
}

/** What saving would meet in the user's account now; `null` when GitHub could not be asked. */
async function inspect(): Promise<SavedSettings | null> {
  looking.value = true;
  try {
    const inspection = await sync.inspect();
    switch (inspection.kind) {
      case 'absent':
      case 'empty':
        return { kind: 'none', inspection };
      case 'found':
        return { kind: 'found', found: inspection };
      case 'unusable':
        return { kind: 'unusable', reason: inspection.reason };
      default:
        return assertNever(inspection);
    }
  } catch (error) {
    logger.warn('The settings saved to GitHub could not be looked for', { error });
    return null;
  } finally {
    looking.value = false;
  }
}

/**
 * Looks again, for the box ticked or "Track these": what is there may have changed since — another device saved its
 * settings. Settings found are offered (G11), and a repository that can't be used says why (G14), the box gone.
 * Whether saving can go on, and from what — `null` when GitHub could not be asked.
 */
async function lookAgain(): Promise<{ readonly inspection: NoSettings | null } | null> {
  const looked = await inspect();
  if (!looked) {
    return { inspection: null };
  }

  saved.value = looked;
  if (looked.kind !== 'none') {
    save.value = false;
    return null;
  }

  return looked;
}

async function setSave(value: boolean) {
  save.value = value;
  if (value && saved.value.kind === 'none' && !saved.value.inspection) {
    await lookAgain();
  }
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

/**
 * "Track these": keeps the choice and goes on. With the box ticked it looks again first — settings found or a
 * repository that can't be used stay on this step (G11, G14) — and then turns saving on behind the download, which
 * creates the repository; a refusal leaves syncing stopped (T7). GitHub out of reach leaves saving off.
 */
async function track() {
  if (looking.value) {
    return;
  }

  let inspection: NoSettings | null = null;
  if (save.value) {
    const looked = await lookAgain();
    if (!looked) {
      return;
    }

    ({ inspection } = looked);
  }

  const choice = getChoice();
  tracking.choose(choice);
  if (inspection) {
    sync.turnOn(inspection).catch((error: unknown) => {
      logger.warn('Saving the settings could not be turned on', { error });
    });
  }

  await goOn(choice.repositories.length + choice.projects.length);
}

/** "Load these" (G11): the settings found replace this device's empty ones, saving goes on, and the choice is made. */
async function loadSaved() {
  const current = saved.value;
  if (current.kind !== 'found') {
    return;
  }

  try {
    await sync.turnOn(current.found);
  } catch (error) {
    logger.warn('The settings saved to GitHub could not be loaded', { error });
    saved.value = { kind: 'none', inspection: null };
    return;
  }

  tracking.markChosen();
  await goOn(tracking.repositories.length + tracking.projects.length);
}

/** On to the first download of what is tracked; with nothing to download, straight to where the user was heading. */
async function goOn(tracked: number) {
  if (tracked === 0) {
    await router.replace(next.value ?? '/');
    return;
  }

  await router.push({ path: FIRST_DOWNLOAD_PATH, query: next.value ? { next: next.value } : {} });
}

function getChoice(): TrackingChoice {
  const read = candidates.value;
  const offered = read ? [...getCandidateRepositories(read), ...getCandidateProjects(read)] : [];
  const byKey = new Map<string, CandidateProject | CandidateRepository>();
  for (const candidate of [...offered, ...found.value]) {
    byKey.set('nameWithOwner' in candidate ? candidate.nameWithOwner : candidate.id, candidate);
  }

  return {
    repositories: repositories.value.flatMap(name => {
      const candidate = byKey.get(name);
      return candidate && 'nameWithOwner' in candidate ? [toTrackedRepository(candidate)] : [];
    }),
    projects: projects.value.flatMap(id => {
      const candidate = byKey.get(id);
      return candidate && !('nameWithOwner' in candidate) ? [toTrackedProject(candidate)] : [];
    }),
  };
}
</script>

<template>
  <FirstSignInFrame
    v-if="auth.viewer"
    :viewer="auth.viewer"
    :step="saved.kind === 'found' ? 'load' : 'choose'"
  >
    <SavedSettingsOffer
      v-if="saved.kind === 'found'"
      :repository="settingsRepository"
      :document="saved.found.document"
      :private-repositories="privateRepositories"
      :load="loadSaved"
      @decline="saved = { kind: 'declined' }"
    />
    <TrackingChooser
      v-else-if="candidates && saved.kind !== 'looking'"
      v-model:repositories="repositories"
      v-model:projects="projects"
      :candidates="candidates"
      :now="now"
      :found="found"
      :approvals="approvals.requests"
      :find="tracking.findCandidate"
      :creates="save ? settingsRepository : null"
      @track="track"
      @only-mine="trackOnlyMine"
      @load-more="tracking.loadMoreRepositories"
      @request-approval="approvals.record"
      @found="addFound"
    >
      <template #saving>
        <SavingChoice
          v-if="saved.kind === 'none'"
          :model-value="save"
          :busy="looking"
          @update:model-value="setSave"
        />
        <SavedSettingsNotLoaded
          v-else-if="saved.kind === 'declined'"
          :reason="null"
          :repository="settingsRepository"
        />
        <SavedSettingsNotLoaded
          v-else-if="saved.kind === 'unusable'"
          :reason="saved.reason"
          :repository="settingsRepository"
        />
      </template>
    </TrackingChooser>
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
