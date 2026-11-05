<!-- `/:owner/:name/pull/:number/files` (also `/changes`): a pull request's review on a page of its own, at GitHub's address of its changed files (D2). Another pull request is another view, as nothing of one's place applies to the next. -->
<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { formatItemReference, getReviewReference } from '@/item/itemRoutes.js';

import ReviewView from './ReviewView.vue';

const route = useRoute();
const reference = computed(() => getReviewReference(route));
</script>

<template>
  <ReviewView
    v-if="reference"
    :key="formatItemReference(reference)"
    :reference="reference"
  />
</template>
