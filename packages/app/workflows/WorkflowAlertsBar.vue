<!-- The bar under a repository's Workflows section's header (actions `Workflow / Alerts bar`, D5): which branches and tags raise alerts here — "Alerts on", the default branch as a chip with GitHub's name of it, the patterns in outlines, so a pattern never looks like the default branch — or, with nothing on, that failures here never mark the repository broken. "Alert settings" on the right, with P, opens the repository's settings on Workflow alerts. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import Button from '@/components/Button.vue';

import type { RepositoryWorkflowAlerts } from './buildRepositoryWorkflows.js';
import * as l from './WorkflowAlertsBar.loc.js';
import WorkflowPatternChip from './WorkflowPatternChip.vue';
import WorkflowRefChip from './WorkflowRefChip.vue';

defineProps<{
  alerts: RepositoryWorkflowAlerts;
  /** Nothing raises alerts here. */
  alertsOff: boolean;
}>();

const emit = defineEmits<{
  /** "Alert settings" pressed: the caller opens the repository's settings on Workflow alerts. */
  settings: [];
}>();

const t = useTranslate();
</script>

<template>
  <div
    :class="css.workflowAlertsBar"
    tid="workflow-alerts-bar"
  >
    <span :class="css.workflowAlertsBar_label">{{ t(l.alertsOn) }}</span>
    <span
      v-if="alertsOff"
      :class="css.workflowAlertsBar_nothing"
      >{{ t(l.nothing) }}</span
    >
    <template v-else>
      <WorkflowRefChip
        v-if="alerts.defaultBranch"
        :name="alerts.defaultBranchName ?? t(l.defaultBranch)"
        kind="branch"
        :text="!alerts.defaultBranchName"
      />
      <WorkflowPatternChip
        v-for="pattern in alerts.patterns"
        :key="pattern"
        :class="css.workflowAlertsBar_pattern"
        :pattern="pattern"
      />
    </template>
    <Button
      :class="css.workflowAlertsBar_settings"
      variant="ghost"
      size="sm"
      kbd="P"
      keyshortcuts="P"
      @click="emit('settings')"
    >
      {{ t(l.settings) }}
    </Button>
  </div>
</template>

<style lang="scss" module="css">
.workflowAlertsBar {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  min-height: 39px;
  padding: 0 20px;
  border-bottom: 1px solid $color-border;
}

// `fg-dim`, not the design's `fg-3`: text in `fg-3` misses AA contrast (`tokens.scss`).
.workflowAlertsBar_label {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.workflowAlertsBar_nothing {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflowAlertsBar_pattern {
  flex: none;
}

.workflowAlertsBar_settings {
  margin-left: auto;
}
</style>
