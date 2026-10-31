<!-- Every address githq does not show — a profile (`/acme`), `/orgs/acme`, a repository's code, `/notifications`, `/settings/profile`, … — handed off to the same address on github.com (`getGitHubUrl`): path, query and fragment, the host fixed in code. It replaces the githq entry in history, so going back does not land here again. Open to everyone, signed out too: nothing of the user's is shown. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useRoute } from 'vue-router';

import { Browser } from '@/services/Browser.js';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';

const browser = useService(Browser);
const route = useRoute();

browser.replaceLocation(getGitHubUrl(route.fullPath));
</script>

<template>
  <!-- Nothing to show: the page is leaving. -->
  <div />
</template>
