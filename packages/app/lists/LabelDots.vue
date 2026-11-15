<!-- Labels as a phone's row draws them (mobile D23): a 7px dot in each label's colour, the names said together to a screen reader and on hover; nothing without labels. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import type { ItemLabel } from '@/store/ItemTypes.js';
import { formatList } from '@/utils/formatList.js';

import * as l from './LabelDots.loc.js';

const props = defineProps<{
  labels: readonly ItemLabel[];
}>();

const t = useTranslate();
const name = computed(() => t(l.labels, { names: formatList(props.labels.map(label => label.name)) }));
</script>

<template>
  <span
    v-if="labels.length > 0"
    :class="css.labelDots"
    role="img"
    :aria-label="name"
    :title="name"
  >
    <span
      v-for="label in labels"
      :key="label.name"
      :class="css.labelDots_dot"
      :style="{ background: `#${label.color}` }"
    />
  </span>
</template>

<style lang="scss" module="css">
.labelDots {
  display: inline-flex;
  flex: none;
  gap: $spacing-4;
}

.labelDots_dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
</style>
