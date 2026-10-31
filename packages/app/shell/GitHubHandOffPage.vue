<!-- Every address githq does not show — a profile (`/acme`), `/orgs/acme`, a repository's code, `/notifications`, `/settings/profile`, … — handed off to the same address on github.com (`getGitHubUrl`): path, query and fragment, the host fixed in code. It replaces the githq entry in history, so going back does not land here again. The desktop app opens it in the system browser instead (`desktop/`) and goes back to where the user was. Open to everyone, signed out too: nothing of the user's is shown. -->
<script lang="ts" setup>
import { useService } from '@nzyme/vue-ioc/useService.js';
import { useRoute, useRouter } from 'vue-router';

import { Browser } from '@/services/Browser.js';
import { getGitHubUrl } from '@/tracking/trackingRoutes.js';

const browser = useService(Browser);
const route = useRoute();
const router = useRouter();

browser.replaceLocation(getGitHubUrl(route.fullPath));
// The desktop app's window never leaves the app: GitHub opened in the browser, and the app goes back.
if (__DESKTOP__) {
  goBack();
}

function goBack() {
  if (router.options.history.state.back == null) {
    void router.replace('/');
  } else {
    router.back();
  }
}
</script>

<template>
  <!-- Nothing to show: the page is leaving. -->
  <div />
</template>
