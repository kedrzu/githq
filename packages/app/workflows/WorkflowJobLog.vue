<!-- A job's log, read and parsed: the pane's part the log viewer fills (actions W4a). For now its shown lines in a plain list, as text only. -->
<script lang="ts" setup>
import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';

import type { ParsedJobLog } from './utils/parseJobLog.js';

defineProps<{
  /** Whose log it is; its steps name the log's. */
  job: GitHubWorkflowJob;
  log: ParsedJobLog;
}>();
</script>

<template>
  <ol
    :class="css.workflowJobLog"
    :aria-label="job.name"
    tabindex="0"
    tid="workflow-job-log"
  >
    <li
      v-for="line in log.lines"
      :key="line.number"
      :class="css.workflowJobLog_line"
    >
      {{ line.text }}
    </li>
  </ol>
</template>

<style lang="scss" module="css">
.workflowJobLog {
  flex: 1;
  min-height: 0;
  padding: 0 $spacing-14;
  margin: 0;
  overflow: auto;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  line-height: 18px;
  color: $color-fg-2;
  list-style: none;
}

.workflowJobLog_line {
  white-space: pre;
}
</style>
