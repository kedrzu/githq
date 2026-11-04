<!-- The toast of a repository that could not be tracked from the command menu (D33): GitHub did not answer, does not show it, or it is the user's own settings repository. It shows wherever the user went meanwhile; closing it, dismissed or timed out, forgets the failure. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';

import Toast from '@/components/Toast.vue';

import { RepositoryTracker } from './RepositoryTracker.js';
import * as l from './TrackFailedToast.loc.js';

const tracker = useService(RepositoryTracker);
const t = useTranslate();

function onOpenChange(open: boolean) {
  if (!open) {
    tracker.dismissFailure();
  }
}
</script>

<template>
  <Toast
    v-if="tracker.failedName"
    :key="tracker.failedName"
    :title="t(l.title, { name: tracker.failedName })"
    @update:open="onOpenChange"
  >
    {{ t(l.description) }}
  </Toast>
</template>
