<!-- The toast of a re-run of a run's failed jobs that did not happen, for a `Toaster` (actions W4l): the app's rejected-edit toast, saying why in GitHub's reason or that GitHub couldn't say, with the way to the run on GitHub — `O` on its page, where that key does it — or, refused by an organisation that has not approved githq, to requesting its approval (G5). One that says the run is running already has nothing to see there: the page follows it. It shows wherever the user went meanwhile; dismissed, it leaves the status bar too, while one that only timed out stays there, and clicking that brings it back. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowUpRight } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { Browser } from '@/services/Browser.js';
import { getGitHubUrl, getWorkflowRunPath, isWorkflowRunRoute } from '@/tracking/trackingRoutes.js';
import { getApprovalUrl } from '@/tracking/utils/getApprovalUrl.js';

import { useWorkflowRerunTexts } from './useWorkflowRerunTexts.js';
import * as l from './useWorkflowRerunTexts.loc.js';
import { WorkflowRunStore } from './WorkflowRunStore.js';

const store = useService(WorkflowRunStore);
const browser = useService(Browser);
const route = useRoute();
const texts = useWorkflowRerunTexts();
const t = useTranslate();

const link = computed(() => {
  const failure = store.rerunFailure;
  if (!failure) {
    return null;
  }

  switch (failure.reason.kind) {
    case 'alreadyRunning':
      return null;
    case 'organizationRestricted':
      return { url: getApprovalUrl(browser.origin), text: t(l.requestAccess), kbd: undefined };
    default:
      return {
        url: getGitHubUrl(getWorkflowRunPath({ nameWithOwner: failure.nameWithOwner, runId: failure.runId })),
        text: t(l.openOnGitHub),
        kbd: isWorkflowRunRoute(route) && Number(route.params.run) === failure.runId ? 'O' : undefined,
      };
  }
});
</script>

<template>
  <Toast
    v-if="store.rerunFailure?.toast"
    :key="store.rerunFailure.at"
    :title="texts.title(store.rerunFailure)"
    @update:open="store.setRerunToast($event)"
    @dismiss="store.dismissRerunFailure()"
  >
    {{ texts.detail(store.rerunFailure) }}
    <template
      v-if="link"
      #actions
    >
      <Button
        variant="secondary"
        size="sm"
        :icon="ArrowUpRight"
        :link="link.url"
        :kbd="link.kbd"
        :aria-keyshortcuts="link.kbd"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ link.text }}
      </Button>
    </template>
  </Toast>
</template>
