<!-- The Privacy section of Settings (T23), wired to `TrackingStore`, which keeps whether usage statistics are shared with the rest of the settings; `UsageStatisticsFlag` mirrors it to the device. On a phone in its one column. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';

import { TrackingStore } from '@/tracking/TrackingStore.js';

import PrivacyView from './PrivacyView.vue';

defineProps<{
  /** In a phone's Settings (mobile D30, D33): one column of rows. */
  phone?: boolean;
}>();

const tracking = useService(TrackingStore);

const usageStatistics = computed({
  get: () => tracking.usageStatistics,
  set: value => tracking.setUsageStatistics(value),
});
</script>

<template>
  <PrivacyView
    v-model="usageStatistics"
    :phone="phone"
  />
</template>
