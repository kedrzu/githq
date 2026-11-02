<!-- A check in the merge panel's list (PM4a, merging D13): its state, name, time and log, a required one that failed on grey. One that isn't required and failed or still runs is grey and says it doesn't stop the merge; `tagged` marks a required one "Required" where nothing else says it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight } from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import { getCheckIcon } from '@/item/getCheckIcon.js';
import RequiredTag from '@/item/RequiredTag.vue';
import { useCheckTexts } from '@/item/useCheckTexts.js';

import * as l from './MergeCheckRow.loc.js';
import type { MergeCheck } from './MergeTypes.js';

const props = defineProps<{
  check: MergeCheck;
  /** Epoch ms a running check's time is counted to. */
  now: number;
  /** A required check is tagged "Required": where no section heading says it. */
  tagged?: boolean;
}>();

const t = useTranslate();
const checkTexts = useCheckTexts();

/** One that isn't required, failing or running: it is grey and says it doesn't stop the merge (D13). */
const notStopping = computed(
  () => !props.check.isRequired && (props.check.state === 'failing' || props.check.state === 'pending'),
);
const name = computed(() => checkTexts.name(props.check));
const detail = computed(() => {
  const text = checkTexts.describe(props.check, props.now);
  return notStopping.value ? t(l.notStopping, { detail: text }) : text;
});
</script>

<template>
  <li :class="[css.mergeCheckRow, check.isRequired && check.state === 'failing' && css.mergeCheckRow_blocking]">
    <component
      :is="getCheckIcon(check.state)"
      :class="[css.mergeCheckRow_icon, css[`mergeCheckRow_icon_${notStopping ? 'skipped' : check.state}`]]"
      aria-hidden="true"
    />
    <span :class="[css.mergeCheckRow_name, notStopping && css.mergeCheckRow_name_optional]">{{ name }}</span>
    <RequiredTag v-if="tagged && check.isRequired" />
    <span :class="css.mergeCheckRow_detail">{{ detail }}</span>
    <Button
      v-if="check.url"
      variant="link"
      size="sm"
      :icon="ArrowUpRight"
      :link="check.url"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="t(l.logOf, { name })"
    >
      {{ t(l.log) }}
    </Button>
  </li>
</template>

<style lang="scss" module="css">
.mergeCheckRow {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-height: 26px;
  padding: $spacing-4 $spacing-8;
  font-size: $font-size-xs;
  white-space: nowrap;
  border-radius: $radius-md;
}

.mergeCheckRow_blocking {
  background: $color-bg-3;
}

.mergeCheckRow_icon {
  flex: none;
  width: 13px;
  height: 13px;
}

.mergeCheckRow_icon_failing {
  color: $color-red;
}

.mergeCheckRow_icon_pending {
  color: $color-amber;
}

.mergeCheckRow_icon_passing {
  color: $color-green;
}

.mergeCheckRow_icon_skipped {
  color: $color-fg-3;
}

.mergeCheckRow_name {
  flex: none;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $font-family-mono;
  color: $color-fg;
}

.mergeCheckRow_name_optional {
  color: $color-fg-2;
}

.mergeCheckRow_detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg-dim;
}
</style>
