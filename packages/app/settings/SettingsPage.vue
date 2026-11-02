<!-- `/settings` (D15): the one Settings screen, its section in the address (`?tab=`, `settingsRoutes.ts`). `?q=` is what What to track's filter holds when it opens. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AccountSection from '@/account/AccountSection.vue';
import TrackingSection from '@/tracking/TrackingSection.vue';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import SavingSection from './SavingSection.vue';
import { getSettingsPath, readSettingsSection } from './settingsRoutes.js';
import SettingsView from './SettingsView.vue';
import { SettingsSync } from './sync/SettingsSync.js';

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
    :tracked="tracking.repositories.length + tracking.projects.length"
    :saving-stopped="sync.state.state === 'stopped'"
  >
    <AccountSection v-if="section === 'account'" />
    <SavingSection v-else-if="section === 'sync'" />
    <TrackingSection
      v-else
      :initial-search="search"
    />
  </SettingsView>
</template>
