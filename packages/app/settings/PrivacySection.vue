<!-- The Privacy section of Settings (T23), wired to `TrackingStore`, which keeps whether usage statistics are shared with the rest of the settings; `UsageStatisticsFlag` mirrors it to the device. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';

import { TrackingStore } from '@/tracking/TrackingStore.js';

import PrivacyView from './PrivacyView.vue';

const tracking = useService(TrackingStore);

const usageStatistics = computed({
  get: () => tracking.usageStatistics,
  set: value => tracking.setUsageStatistics(value),
});
</script>

<template>
  <PrivacyView v-model="usageStatistics" />
</template>
