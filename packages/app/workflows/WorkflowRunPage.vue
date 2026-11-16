<!-- `/owner/name/actions/runs/123` and `…/job/456`: a run of a tracked repository's workflow (actions W4a), at GitHub's addresses of it, full page; a repository not tracked hands off to GitHub (`middleware/auth.global.ts`, D4). The run and the job the address names, shown and moved as an opened run is (`OpenedWorkflowRun`); as the page is left, the run and the job it showed stay until it is gone. -->
<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import OpenedWorkflowRun from './OpenedWorkflowRun.vue';
import { WorkflowRunRoutes } from './workflowRunRoutes.js';
import type { WorkflowRunReference } from './workflowRunRoutes.js';

const route = useRoute();

// What the address names while it is the run's page; the last one as the page is left, so nothing changes under it.
const reference = computed<WorkflowRunReference | null>(previous => {
  const opened = WorkflowRunRoutes.getOpened(route);
  return opened?.onPage ? opened.reference : (previous ?? null);
});
</script>

<template>
  <OpenedWorkflowRun
    v-if="reference"
    :reference="reference"
    arrangement="page"
  />
</template>
