<!-- `/settings` (D15): the one Settings screen, its section in the address (`?tab=`, `settingsRoutes.ts`). `?q=` opens the Repositories or Projects section's picker with that search (`TrackedRepositoriesSection.vue`, `TrackedProjectsSection.vue`). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AccountSection from '@/account/AccountSection.vue';
import TrackedProjectsSection from '@/tracking/TrackedProjectsSection.vue';
import TrackedRepositoriesSection from '@/tracking/TrackedRepositoriesSection.vue';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import CodeReviewSection from './CodeReviewSection.vue';
import DisplaySection from './DisplaySection.vue';
import SavingSection from './SavingSection.vue';
import { getSettingsPath, readSettingsSection } from './settingsRoutes.js';
import SettingsView from './SettingsView.vue';
import { SettingsSync } from './sync/SettingsSync.js';

// The desktop app's sections, in the desktop build only (`__DESKTOP__`); the web builds drop them.
const UpdatesSection = __DESKTOP__ ? defineAsyncComponent(() => import('./UpdatesSection.vue')) : null;
const ChangelogSection = __DESKTOP__ ? defineAsyncComponent(() => import('./ChangelogSection.vue')) : null;

const tracking = useService(TrackingStore);
const sync = useService(SettingsSync);
const route = useRoute();
const router = useRouter();

const search = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''));
const section = computed({
  get: () => readSettingsSection(route.query.tab),
  set: value => void router.replace(getSettingsPath(value)),
});
</script>

<template>
  <SettingsView
    v-model:section="section"
    :tracked-repositories="tracking.repositories.length"
    :tracked-projects="tracking.projects.length"
    :saving-stopped="sync.state.state === 'stopped'"
  >
    <component
      :is="UpdatesSection"
      v-if="UpdatesSection && section === 'updates'"
    />
    <component
      :is="ChangelogSection"
      v-else-if="ChangelogSection && section === 'changelog'"
    />
    <AccountSection v-else-if="section === 'account'" />
    <SavingSection v-else-if="section === 'sync'" />
    <CodeReviewSection v-else-if="section === 'review'" />
    <DisplaySection v-else-if="section === 'display'" />
    <TrackedProjectsSection
      v-else-if="section === 'projects'"
      :initial-search="search"
    />
    <TrackedRepositoriesSection
      v-else
      :initial-search="search"
    />
  </SettingsView>
</template>
