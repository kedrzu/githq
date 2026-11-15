<!-- `/:owner/:name/issues/:number`, `/:owner/:name/pull/:number` `/:owner/:name/actions/workflows/:file` and `/:owner/:name/commit/:oid`: an item on a page of its own (D9), at a GitHub-shaped address — reload, Back and a pasted github.com path open it again. A workflow shows its workflow view (`OpenedWorkflow`), a commit its details (`OpenedCommit`). -->
<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import OpenedCommit from '@/commits/OpenedCommit.vue';
import OpenedWorkflow from '@/workflows/OpenedWorkflow.vue';

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
  <OpenedWorkflow
    v-else-if="opened?.kind === 'workflow'"
    :reference="opened.reference"
    arrangement="page"
  />
  <OpenedCommit
    v-else-if="opened?.kind === 'commit'"
    :reference="opened.reference"
    arrangement="page"
  />
</template>
