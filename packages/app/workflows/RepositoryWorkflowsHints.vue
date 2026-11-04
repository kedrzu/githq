<!-- The Workflows tab's key hints in the repository's toolbar (actions W3a, W3b): Enter opens and → unfolds the other runs; with a workflow unfolded, Enter opens a run, ← folds and F filters by ref. For the eye only: the keys are in the help sheet. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import Kbd from '@/components/Kbd.vue';

import * as l from './RepositoryWorkflowsHints.loc.js';

const props = defineProps<{
  /** A workflow is unfolded. */
  unfolded: boolean;
}>();

const t = useTranslate();

const hints = computed(() =>
  props.unfolded
    ? [
        { keys: 'Enter', label: t(l.openRun) },
        { keys: 'ArrowLeft', label: t(l.fold) },
        { keys: 'F', label: t(l.ref) },
      ]
    : [
        { keys: 'Enter', label: t(l.open) },
        { keys: 'ArrowRight', label: t(l.otherRuns) },
      ],
);
</script>

<template>
  <span
    :class="css.repositoryWorkflowsHints"
    aria-hidden="true"
  >
    <span
      v-for="hint in hints"
      :key="hint.keys"
      :class="css.repositoryWorkflowsHints_hint"
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
</style>
