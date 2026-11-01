<!-- `/settings` (D15): the one Settings screen, its section in the address (`?tab=`, `settingsRoutes.ts`). "Saving to GitHub" shows nothing yet. A section's controls go into the header from the section itself (`SettingsView`). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AccountSection from '@/account/AccountSection.vue';
import TrackingSection from '@/tracking/TrackingSection.vue';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { getSettingsPath, readSettingsSection } from './settingsRoutes.js';
import SettingsView from './SettingsView.vue';

const tracking = useService(TrackingStore);
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
    :repositories="tracking.repositories.length"
    :projects="tracking.projects.length"
  >
    <AccountSection v-if="section === 'account'" />
    <TrackingSection
      v-else-if="section !== 'saving'"
      :tab="section"
      :initial-search="search"
    />
  </SettingsView>
</template>
