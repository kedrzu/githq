<!-- The Code review section of Settings (code-review D34), wired to `TrackingStore`, which keeps the choice with the rest of the settings. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed } from 'vue';

import { TrackingStore } from '@/tracking/TrackingStore.js';

import CodeReviewView from './CodeReviewView.vue';

const tracking = useService(TrackingStore);

const choice = computed({
  get: () => tracking.reviewCommentChoice,
  set: value => tracking.setReviewCommentChoice(value),
});
</script>

<template>
  <CodeReviewView v-model="choice" />
</template>
