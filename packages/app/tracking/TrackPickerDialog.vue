<!-- The modal the pickers share (T18 `TrackRepositoriesDialog`, T22 `TrackProjectsDialog`, D25): its head with the title, the description and the Esc hint, the chooser in the default slot, and the footer naming what is picked with Cancel (Esc) and the track button (⌘↵, which the chooser emits), disabled with nothing picked. Esc clears a filter holding text first, then closes without asking. It opens focused on itself, not on its first control, so J, K and `/` are keys rather than text in the filter; the keys belong to it while it is open: nothing of the screen beneath runs (`data-no-commands`, `data-layer`). On a phone (`PhoneLayout.active`, mobile D35, MB168, MB172) it is a screen of its own — the first sign-in's choosing screen — its top bar with back naming the screen it was opened from (`parent`, closing it as Cancel does) and the title, the footer pinned at the bottom with what is picked over the track button the width of the screen — the screen covering what the on-screen keyboard leaves of the window (`usePhoneScreenOverKeyboard`), so the footer rides above the keyboard while the search is typed into, as on the first sign-in (`FirstSignInFrame`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { Plus } from 'lucide-vue-next';
import { useTemplateRef } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';
import Dialog from '@/components/Dialog.vue';
import Kbd from '@/components/Kbd.vue';
import { KeyHintsContext } from '@/components/KeyHintsContext.js';
import PhoneBackButton from '@/shell/PhoneBackButton.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import PhoneTopBar from '@/shell/PhoneTopBar.vue';
import { usePhoneScreenOverKeyboard } from '@/shell/usePhoneScreenOverKeyboard.js';

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
  /** On a phone, the screen back returns to ("Repositories"). */
  parent: string;
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
const phone = useService(PhoneLayout);
// A phone has no keys to hint at (mobile D52).
provideContext(KeyHintsContext, {
  get hidden() {
    return phone.active;
  },
});
const layer = useTemplateRef<HTMLElement>('layer');
const phoneStyle = usePhoneScreenOverKeyboard();

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
    :edge="phone.active ? 'full' : undefined"
    bare
    fit-content
    @escape-key-down="onEscape"
    @open-auto-focus="onOpenFocus"
  >
    <div
      ref="layer"
      :class="[css.trackPickerDialog, phone.active && css.trackPickerDialog_phone]"
      :style="phoneStyle"
      tabindex="-1"
      data-no-commands
      data-layer
    >
      <PhoneTopBar
        v-if="phone.active"
        :title="title"
      >
        <template #start>
          <PhoneBackButton
            :place="parent"
            @click="open = false"
          />
        </template>
      </PhoneTopBar>
      <!-- What the dialog's own title and description read out already. -->
      <header
        v-else
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

      <footer :class="[css.trackPickerDialog_footer, phone.active && css.trackPickerDialog_footer_phone]">
        <p :class="css.trackPickerDialog_summary">{{ summary }}</p>
        <Button
          v-if="!phone.active"
          kbd="Escape"
          @click="open = false"
        >
          {{ t(l.cancel) }}
        </Button>
        <Button
          variant="primary"
          :size="phone.active ? 'lg' : undefined"
          :class="phone.active && css.trackPickerDialog_phoneTrack"
          :icon="phone.active ? undefined : Plus"
          :keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
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
// A fixed height, whatever the list holds, so filtering doesn't move the footer: T18's 535px at the least, growing
// with the window so a long list scrolls less.
.trackPickerDialog {
  display: flex;
  flex-direction: column;
  height: max(535px, 70vh);
  max-height: 78vh;
  outline: none;
}

// A screen of its own on a phone, pinned over the part of the window the user sees by its inline style
// (`usePhoneScreenOverKeyboard`): the chooser scrolls between the top bar and the footer.
.trackPickerDialog.trackPickerDialog_phone {
  max-height: none;
  background: $color-bg;
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

.trackPickerDialog_footer_phone {
  flex-direction: column;
  align-items: stretch;
  padding: $spacing-12 $spacing-16 calc(#{$spacing-12} + #{$phone-home-indicator-room});
}

.trackPickerDialog_phoneTrack {
  width: 100%;
  min-height: $touch-target-size;
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
