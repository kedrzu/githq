<!-- The Display section of Settings (git-client D22), wired to `TrackingStore`, which keeps the repository layout and whether things animate with the rest of the settings; on a phone only whether things animate (mobile D30). -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';

import { TrackingStore } from '@/tracking/TrackingStore.js';

import DisplayView from './DisplayView.vue';

defineProps<{
  /** In a phone's Settings (mobile D30, D33): one column of rows. */
  phone?: boolean;
}>();

const tracking = useService(TrackingStore);

const layout = computed({
  get: () => tracking.repositoryLayout,
  set: value => tracking.setRepositoryLayout(value),
});

const animations = computed({
  get: () => tracking.animations,
  set: value => tracking.setAnimations(value),
});
</script>

<template>
  <DisplayView
    v-model="layout"
    v-model:animations="animations"
    :phone="phone"
  />
</template>
