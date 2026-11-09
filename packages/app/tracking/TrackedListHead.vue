<!-- The head of Settings' Repositories and Projects (G8, T17 `QpXtY`): how many are tracked ("15 tracked repositories"), what githq does with them, and the button adding more ("Track repositories A"), which opens the picker. The key itself is the list's (`TrackedListView`). -->
<script lang="ts" setup>
import { Plus } from 'lucide-vue-next';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';

defineProps<{
  title: string;
  description: string;
  /** "Track repositories", "Track projects". */
  addLabel: string;
  /** Its key, in the app's notation. */
  addKey: string;
}>();

const emit = defineEmits<{
  add: [];
}>();
</script>

<template>
  <header :class="css.trackedListHead">
    <div :class="css.trackedListHead_text">
      <h2 :class="css.trackedListHead_title">{{ title }}</h2>
      <p :class="css.trackedListHead_description">{{ description }}</p>
    </div>
    <Button
      variant="outline"
      size="sm"
      :icon="Plus"
      :kbd="addKey"
      :keyshortcuts="formatAriaKeyShortcuts(addKey)"
      @click="emit('add')"
    >
      {{ addLabel }}
    </Button>
  </header>
</template>

<style lang="scss" module="css">
.trackedListHead {
  display: flex;
  gap: $spacing-16;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 $spacing-12;
}

.trackedListHead_text {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
}

.trackedListHead_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.trackedListHead_description {
  font-size: $font-size-sm;
  color: $color-fg-2;
}
</style>
