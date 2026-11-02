<!-- The bar under a repository's Workflows tab's header (actions `Workflow / Alerts bar`, D5): which branches and tags raise alerts here — "Alerts on", the default branch as a chip with GitHub's name of it, the patterns in outlines, so a pattern never looks like the default branch — or, with nothing on, that failures here never mark the repository broken. "Alert settings" on the right, with P, opens the repository's settings on Workflow alerts. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { GitBranch } from 'lucide-vue-next';

import Button from '@/components/Button.vue';

import type { RepositoryWorkflowAlerts } from './buildRepositoryWorkflows.js';
import * as l from './WorkflowAlertsBar.loc.js';

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
      <span
        v-if="alerts.defaultBranch"
        :class="css.workflowAlertsBar_ref"
      >
        <GitBranch
          :class="css.workflowAlertsBar_refIcon"
          aria-hidden="true"
        />
        <span
          :class="[css.workflowAlertsBar_refName, !alerts.defaultBranchName && css.workflowAlertsBar_refName_text]"
          >{{ alerts.defaultBranchName ?? t(l.defaultBranch) }}</span
        >
      </span>
      <code
        v-for="pattern in alerts.patterns"
        :key="pattern"
        :class="css.workflowAlertsBar_pattern"
        >{{ pattern }}</code
      >
    </template>
    <Button
      :class="css.workflowAlertsBar_settings"
      variant="ghost"
      size="sm"
      kbd="P"
      aria-keyshortcuts="P"
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

// `Workflow alerts / Ref`: a branch as a chip.
.workflowAlertsBar_ref {
  display: inline-flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
  padding: $spacing-2 $spacing-6;
  background: $color-bg-3;
  border-radius: $radius-sm;
}

.workflowAlertsBar_refIcon {
  width: 11px;
  height: 11px;
  color: $color-fg-3;
}

.workflowAlertsBar_refName {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
}

.workflowAlertsBar_refName_text {
  font-family: inherit;
}

// `Workflow alerts / Pattern`: typed by the user, so outlined — never like the default branch.
.workflowAlertsBar_pattern {
  flex: none;
  padding: 1px $spacing-6;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.workflowAlertsBar_settings {
  margin-left: auto;
}
</style>
