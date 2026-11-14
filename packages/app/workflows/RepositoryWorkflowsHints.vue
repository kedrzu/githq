<!-- The Workflows section's key hints in the repository's toolbar (actions W35): Enter opens the selected workflow, ⇧Enter full screen and F its latest failure — dimmed while it has none. For the eye only: the keys are in the help sheet. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import Kbd from '@/components/Kbd.vue';

import * as l from './RepositoryWorkflowsHints.loc.js';

const props = defineProps<{
  /** The selected workflow has a failed run F opens. */
  failure: boolean;
}>();

const t = useTranslate();

const hints = computed(() => [
  { keys: 'Enter', label: t(l.open), off: false },
  { keys: 'Shift+Enter', label: t(l.fullScreen), off: false },
  { keys: 'F', label: t(l.latestFailure), off: !props.failure },
]);
</script>

<template>
  <span
    :class="css.repositoryWorkflowsHints"
    aria-hidden="true"
  >
    <span
      v-for="hint in hints"
      :key="hint.keys"
      :class="[css.repositoryWorkflowsHints_hint, hint.off && css.repositoryWorkflowsHints_hint_off]"
      :aria-disabled="hint.off || undefined"
    >
      <Kbd :keys="hint.keys" />
      {{ hint.label }}
    </span>
  </span>
</template>

<style lang="scss" module="css">
.repositoryWorkflowsHints {
  display: inline-flex;
  flex: none;
  gap: $spacing-12;
  align-items: center;
}

.repositoryWorkflowsHints_hint {
  display: inline-flex;
  gap: $spacing-5;
  align-items: center;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

// Nothing to open: the key does nothing on this row. Inactive, so below the contrast text needs (WCAG 1.4.3).
.repositoryWorkflowsHints_hint_off {
  color: $color-fg-3;
}
</style>
