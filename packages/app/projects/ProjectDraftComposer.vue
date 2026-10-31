<!-- Writing a draft issue straight into a project (D4, H5): one line for its title, at the end of a group or at the bottom of a board's column — the draft takes that group's value. Enter adds it and leaves the line open for the next one; Escape, or leaving it empty, closes it. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { onMounted, ref, useTemplateRef } from 'vue';

import TextField from '@/components/TextField.vue';

import * as l from './ProjectDraftComposer.loc.js';

defineProps<{
  /** Where it is written ("In progress"), for the field's name; `null` in a list with no groups. */
  group: string | null;
}>();

const emit = defineEmits<{
  /** Enter: add a draft with this title. */
  add: [title: string];
  /** Escape, or Enter on nothing. */
  close: [];
}>();

const t = useTranslate();
const title = ref('');
const fieldRef = useTemplateRef<InstanceType<typeof TextField>>('field');

onMounted(() => fieldRef.value?.focus());

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
    return;
  }

  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    const text = title.value.trim();
    if (!text) {
      emit('close');
      return;
    }

    emit('add', text);
    title.value = '';
  }
}
</script>

<template>
  <div
    :class="css.projectDraftComposer"
    @keydown="onKeydown"
  >
    <TextField
      ref="field"
      v-model="title"
      :label="group === null ? t(l.label) : t(l.labelIn, { group })"
      label-hidden
      :placeholder="t(l.placeholder)"
      autocomplete="off"
    />
  </div>
</template>

<style lang="scss" module="css">
.projectDraftComposer {
  padding: $spacing-4 $spacing-16 $spacing-8 41px;
}
</style>
