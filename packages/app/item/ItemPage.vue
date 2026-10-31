<!-- `/:owner/:name/issues/:number` and `/:owner/:name/pull/:number`: an item on a page of its own (D9), at a GitHub-shaped address — reload, Back and a pasted github.com path open it again. -->
<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { getOpenedItemRoute } from './itemRoutes.js';
import OpenedItem from './OpenedItem.vue';

const route = useRoute();
const opened = computed(() => getOpenedItemRoute(route));
</script>

<template>
  <OpenedItem
    v-if="opened"
    :reference="opened.reference"
    arrangement="page"
  />
</template>
