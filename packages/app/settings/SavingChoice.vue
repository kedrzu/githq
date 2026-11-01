<!-- The choice to save what is tracked to the user's GitHub account (settings-sync D2, D3; T3, G2): the checkbox and what it does, in the same words in Settings and on the first sign-in. Space or a click ticks it; `busy` shows it ticked and still while GitHub is asked. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { LoaderCircle } from 'lucide-vue-next';

import Checkbox from '@/components/Checkbox.vue';

import * as l from './SavingChoice.loc.js';

defineProps<{
  /** GitHub is being asked what ticking it meets: ticked, and not to be changed until it answers. */
  busy?: boolean;
}>();

const model = defineModel<boolean>({ required: true });

const t = useTranslate();
</script>

<template>
  <div
    :class="css.savingChoice"
    :aria-busy="busy || undefined"
  >
    <Checkbox
      v-model="model"
      :disabled="busy"
      :class="css.savingChoice_checkbox"
    >
      <span :class="css.savingChoice_label">{{ t(l.label) }}</span>
      <LoaderCircle
        v-if="busy"
        :class="css.savingChoice_busy"
        aria-hidden="true"
      />
    </Checkbox>
    <p :class="css.savingChoice_explanation">{{ t(l.explanation) }}</p>
  </div>
</template>

<style lang="scss" module="css">
.savingChoice {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.savingChoice_checkbox {
  align-self: flex-start;
}

.savingChoice_label {
  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.savingChoice_busy {
  width: 13px;
  height: 13px;
  color: $color-fg-dim;
  animation: saving-choice-spin 1s linear infinite;
}

// Under the label, past the box and its gap.
.savingChoice_explanation {
  padding-left: 24px;
  font-size: $font-size-sm;
  line-height: 1.5;
  color: $color-fg-2;
}

@keyframes saving-choice-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
