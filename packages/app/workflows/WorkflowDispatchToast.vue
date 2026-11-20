<!-- The toasts of running a workflow by hand (actions W37, W39), for a `Toaster`: the run started — "Deploy started on main · #4826", the inputs sent and that GitHub queued it — with Open (⌥O, on the newest toast) going to the run's page; or the dispatch GitHub did not take and why, in GitHub's words where it gave some, with the way to request an organisation's approval where that is why (G5). -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowUpRight, CircleDashed } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { openStartedRun } from '@/commands/definitions/index.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { keyOf } from '@/commands/keyOf.js';
import Button from '@/components/Button.vue';
import Toast from '@/components/Toast.vue';
import { Browser } from '@/services/Browser.js';
import { getWorkflowRunPath } from '@/tracking/trackingRoutes.js';
import { getApprovalUrl } from '@/tracking/utils/getApprovalUrl.js';
import { formatTime } from '@/utils/formatTime.js';

import { WorkflowDispatch } from './WorkflowDispatch.js';
import type { WorkflowDispatchFailure, WorkflowDispatchStarted } from './WorkflowDispatch.js';
import * as l from './WorkflowDispatchToast.loc.js';

const dispatches = useService(WorkflowDispatch);
const browser = useService(Browser);
const router = useRouter();
const t = useTranslate();

const commands = computed((): BoundCommand[] => [
  bindCommand(openStartedRun, { section: 'app', proposed: true, run: openStarted }, t),
]);

function getStartedTitle(started: WorkflowDispatchStarted) {
  const params = { workflow: started.workflowName, ref: started.ref };
  return started.runNumber === null
    ? t(l.startedNoNumber, params)
    : t(l.started, { ...params, number: started.runNumber });
}

function getStartedDetail(started: WorkflowDispatchStarted) {
  const inputs = Object.entries(started.inputs).map(([name, value]) =>
    t(l.inputValue, { name, value: typeof value === 'boolean' ? t(value ? l.on : l.off) : value }),
  );
  return [inputs.join(' · '), t(l.queued)].filter(Boolean).join('. ');
}

function getFailureTitle({ reason, workflowName: workflow, ref }: WorkflowDispatchFailure) {
  switch (reason.kind) {
    case 'noPermission':
      return t(l.titleNoPermission, { workflow });
    case 'notFound':
      return t(l.titleNotFound, { workflow });
    case 'organizationRestricted':
      return t(l.titleOrganizationRestricted, { workflow, organization: reason.organization });
    case 'refused':
      return t(l.titleRefused, { workflow, ref });
    case 'unreachable':
      return t(l.titleUnreachable, { workflow });
    case 'serverError':
      return t(l.titleServerError, { workflow });
    case 'allowance':
      return t(l.titleAllowance, { workflow });
    default:
      return assertNever(reason);
  }
}

function getFailureDetail({ reason, nameWithOwner: repository, ref }: WorkflowDispatchFailure) {
  switch (reason.kind) {
    case 'noPermission':
      return t(l.detailNoPermission, { repository });
    case 'notFound':
      return t(l.detailNotFound, { repository, ref });
    case 'organizationRestricted':
      return t(l.detailOrganizationRestricted, { organization: reason.organization });
    case 'refused':
      return t(l.detailRefused, { message: reason.message.replace(/\.$/u, '') });
    case 'unreachable':
      return t(l.detailUnreachable);
    case 'serverError':
      return t(l.detailServerError, { status: reason.status });
    case 'allowance':
      return t(l.detailAllowance, { time: formatTime(reason.until) });
    default:
      return assertNever(reason);
  }
}

function openStarted() {
  const { started } = dispatches;
  if (started) {
    dispatches.dismissStarted();
    void router.push(getWorkflowRunPath({ nameWithOwner: started.nameWithOwner, runId: started.runId }));
  }
}
</script>

<template>
  <Toast
    v-if="dispatches.started"
    :key="`started:${dispatches.started.at}`"
    :title="getStartedTitle(dispatches.started)"
    tone="neutral"
    :icon="CircleDashed"
    lasts="long"
    :commands="commands"
    @update:open="open => open || dispatches.dismissStarted()"
  >
    {{ getStartedDetail(dispatches.started) }}
    <template #actions="{ active, size }">
      <Button
        variant="secondary"
        :size="size"
        :kbd="active ? keyOf(openStartedRun) : undefined"
        :keyshortcuts="active ? formatAriaKeyShortcuts(keyOf(openStartedRun)) : undefined"
        @click="openStarted"
      >
        {{ t(l.open) }}
      </Button>
    </template>
  </Toast>
  <Toast
    v-if="dispatches.failure"
    :key="`failure:${dispatches.failure.at}`"
    :title="getFailureTitle(dispatches.failure)"
    lasts="long"
    @update:open="open => open || dispatches.dismissFailure()"
  >
    {{ getFailureDetail(dispatches.failure) }}
    <template
      v-if="dispatches.failure.reason.kind === 'organizationRestricted'"
      #actions="{ size }"
    >
      <Button
        variant="secondary"
        :size="size"
        :icon="ArrowUpRight"
        :link="getApprovalUrl(browser.origin)"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t(l.requestAccess) }}
      </Button>
    </template>
  </Toast>
</template>
