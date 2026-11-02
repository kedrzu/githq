<!-- The modal the pickers share (T18 `TrackRepositoriesDialog`, T22 `TrackProjectsDialog`, D25): its head with the title, the description and the Esc hint, the chooser in the default slot, and the footer naming what is picked with Cancel (Esc) and the track button (⌘↵, which the chooser emits), disabled with nothing picked. Esc clears a filter holding text first, then closes without asking. It opens focused on itself, not on its first control, so J, K and `/` are keys rather than text in the filter; the keys belong to it while it is open: nothing of the screen beneath runs (`data-no-commands`, `data-layer`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Plus } from 'lucide-vue-next';
import { useTemplateRef } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import Kbd from '@/components/Kbd.vue';

import * as l from './TrackPickerDialog.loc.js';

defineProps<{
  title: string;
  description: string;
  /** Width in px. */
  width: number;
  /** What the footer says is picked ("1 picked: fitloop/Bug triage"). */
  summary: string;
  /** The track button's text ("Track 1 project"). */
  trackLabel: string;
  /** Something is picked: the track button can be pressed. */
  canTrack: boolean;
}>();

defineSlots<{
  /** The chooser. */
  default(): unknown;
}>();

const emit = defineEmits<{
  /** The track button. */
  track: [];
}>();

const open = defineModel<boolean>('open', { default: false });
/** The chooser's filter: Esc clears it before it closes the dialog. */
const filter = defineModel<string>('filter', { default: '' });

const t = useTranslate();
const layer = useTemplateRef<HTMLElement>('layer');

function onOpenFocus(event: Event) {
  event.preventDefault();
  layer.value?.focus();
}

function onEscape(event: KeyboardEvent) {
  if (filter.value !== '') {
    event.preventDefault();
    filter.value = '';
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="title"
    :description="description"
    :width="width"
    bare
    fit-content
    @escape-key-down="onEscape"
    @open-auto-focus="onOpenFocus"
  >
    <div
      ref="layer"
      :class="css.trackPickerDialog"
      tabindex="-1"
      data-no-commands
      data-layer
    >
      <!-- What the dialog's own title and description read out already. -->
      <header
        :class="css.trackPickerDialog_head"
        aria-hidden="true"
      >
        <div :class="css.trackPickerDialog_heading">
          <p :class="css.trackPickerDialog_title">{{ title }}</p>
          <p :class="css.trackPickerDialog_description">{{ description }}</p>
        </div>
        <Kbd keys="Escape" />
      </header>

      <slot />

      <footer :class="css.trackPickerDialog_footer">
        <p :class="css.trackPickerDialog_summary">{{ summary }}</p>
        <Button
          kbd="Escape"
          @click="open = false"
        >
          {{ t(l.cancel) }}
        </Button>
        <Button
          variant="primary"
          :icon="Plus"
          :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
          :disabled="!canTrack"
          @click="emit('track')"
        >
          {{ trackLabel }}
        </Button>
      </footer>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
// T18's height, whatever the list holds, so filtering doesn't move the footer.
.trackPickerDialog {
  display: flex;
  flex-direction: column;
  height: 535px;
  max-height: 78vh;
  outline: none;
}

.trackPickerDialog_head {
  display: flex;
  flex: none;
  gap: $spacing-12;
  align-items: flex-start;
  justify-content: space-between;
  padding: $spacing-16 20px $spacing-12;
}

.trackPickerDialog_heading {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.trackPickerDialog_title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.trackPickerDialog_description {
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.trackPickerDialog_footer {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  padding: $spacing-12 20px;
  border-top: 1px solid $color-border;
}

.trackPickerDialog_summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
