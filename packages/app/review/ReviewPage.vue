<!-- `/:owner/:name/pull/:number/files` (also `/changes`): a pull request's review on a page of its own, at GitHub's address of its changed files (D2). Another pull request is another view, as nothing of one's place applies to the next; find's query and bar are the page's, staying across J/K and going when the review is left (D47). -->
<script lang="ts" setup>
import { computed, shallowRef } from 'vue';
import { useRoute } from 'vue-router';

import { formatItemReference, getReviewReference } from '@/item/itemRoutes.js';

import ReviewView from './ReviewView.vue';

const route = useRoute();
const reference = computed(() => getReviewReference(route));
const findQuery = shallowRef('');
const findOpen = shallowRef(false);
</script>

<template>
  <ReviewView
    v-if="reference"
    :key="formatItemReference(reference)"
    v-model:find-query="findQuery"
    v-model:find-open="findOpen"
    :reference="reference"
  />
</template>
