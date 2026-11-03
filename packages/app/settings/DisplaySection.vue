<!-- The Display section of Settings (git-client D22), wired to `TrackingStore`, which keeps the repository layout with the rest of the settings, and to `SettingsSync`, which says where they are saved. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import DisplayView from './DisplayView.vue';
import { SettingsSync } from './sync/SettingsSync.js';

const auth = useService(AuthStore);
const tracking = useService(TrackingStore);
const sync = useService(SettingsSync);

const layout = computed({
  get: () => tracking.repositoryLayout,
  set: value => tracking.setRepositoryLayout(value),
});
</script>

<template>
  <DisplayView
    v-if="auth.viewer"
    v-model="layout"
    :login="auth.viewer.login"
    :saving="sync.state.state"
  />
</template>
