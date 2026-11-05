<!-- The Display section of Settings (git-client D22), wired to `TrackingStore`, which keeps the repository layout with the rest of the settings. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';

import { TrackingStore } from '@/tracking/TrackingStore.js';

import DisplayView from './DisplayView.vue';

const tracking = useService(TrackingStore);

const layout = computed({
  get: () => tracking.repositoryLayout,
  set: value => tracking.setRepositoryLayout(value),
});
</script>

<template>
  <DisplayView v-model="layout" />
</template>
