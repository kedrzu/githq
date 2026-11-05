<!-- A repository's left column beside a pane (`ColumnSplit`), one width wherever it shows: 280 px by default, from 200 to 480 px. The pane follows it through `--column-split-width`. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import ColumnSplit from '@/components/ColumnSplit.vue';

import * as l from './RepositoryColumnSplit.loc.js';

defineProps<{
  /** Whether the column is there; the pane has all the width when it is not. */
  shown: boolean;
}>();

defineSlots<{
  /** The column; fills its panel, whose right border is the line beside the pane. */
  column?(): unknown;
  /** The pane. */
  default?(): unknown;
}>();

const WIDTH = { key: 'repositoryColumn', default: 280, min: 200, max: 480 };

const t = useTranslate();
</script>

<template>
  <ColumnSplit
    :shown="shown"
    :width="WIDTH"
    :label="t(l.resizeColumn)"
  >
    <template #column>
      <slot name="column" />
    </template>
    <slot />
  </ColumnSplit>
</template>
