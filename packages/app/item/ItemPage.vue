<!-- `/:owner/:name/issues/:number`, `/:owner/:name/pull/:number` and `/:owner/:name/actions/workflows/:file`: an item on a page of its own (D9), at a GitHub-shaped address — reload, Back and a pasted github.com path open it again. A workflow shows nothing yet; its view comes with the workflow browser. -->
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
    v-if="opened?.kind === 'issue'"
    :reference="opened.reference"
    arrangement="page"
  />
</template>
