<!-- The search of the tracking chooser on a phone (mobile MB135, MB138, MB163), pinned at the top of its scroll: a finger-sized field with a button clearing what is typed, whether it has the cursor told through `focused`, and what the slot adds under it (the segments). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleX } from 'lucide-vue-next';
import { useTemplateRef } from 'vue';

import IconButton from '@/components/IconButton.vue';
import SearchField from '@/components/SearchField.vue';

import * as l from './TrackingChooserPhoneTools.loc.js';

defineProps<{
  /** Read out only. */
  label: string;
  placeholder: string;
}>();
const emit = defineEmits<{
  keydown: [event: KeyboardEvent];
}>();
defineSlots<{
  /** Under the field (the segments). */
  default?(): unknown;
}>();

const filter = defineModel<string>({ required: true });
/** The field has the cursor. */
const focused = defineModel<boolean>('focused', { default: false });
const field = useTemplateRef<{ focus(): void }>('field');

const t = useTranslate();

defineExpose({
  /** Puts the cursor in the field. */
  focus: () => field.value?.focus(),
});
</script>

<template>
  <div :class="css.trackingChooserPhoneTools">
    <SearchField
      ref="field"
      v-model="filter"
      :class="css.trackingChooserPhoneTools_search"
      :label="label"
      :placeholder="placeholder"
      @keydown="emit('keydown', $event)"
      @focusin="focused = true"
      @focusout="focused = false"
    >
      <template
        v-if="filter !== ''"
        #end
      >
        <IconButton
          :icon="CircleX"
          :label="t(l.clearSearch)"
          @click="filter = ''"
        />
      </template>
    </SearchField>
    <slot />
  </div>
</template>

<style lang="scss" module="css">
.trackingChooserPhoneTools {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-8 $spacing-16 $spacing-6;
  background: $color-bg;

  .trackingChooserPhoneTools_search {
    --search-field-background: #{$color-bg-2};

    min-height: $touch-target-size;
    padding: $spacing-4 $spacing-6 $spacing-4 $spacing-12;
    font-size: $font-size-phone-input;
    border-radius: $radius-lg;
  }
}
</style>
