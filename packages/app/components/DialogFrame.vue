<!-- What a short dialog is drawn in — a draft review's (CR39, CR75), deleting a comment (F15): in the middle of the screen, its title and Esc above, what it says in between, its buttons along the bottom. The keys are the dialog's while it is open. -->
<script lang="ts" setup>
import { useTemplateRef } from 'vue';

import Dialog from '@/components/Dialog.vue';
import DialogHead from '@/components/DialogHead.vue';

const props = defineProps<{
  title: string;
  width: number;
  /** A selector of what takes the focus as it opens, instead of what comes first. */
  initialFocus?: string;
  /** The body's class, for how far apart its parts are. */
  bodyClass?: string;
}>();

const emit = defineEmits<{
  keydown: [event: KeyboardEvent];
}>();

defineSlots<{
  default(): unknown;
  footer(): unknown;
}>();

const open = defineModel<boolean>('open', { default: false });

const root = useTemplateRef<HTMLElement>('root');

function onOpenFocus(event: Event) {
  if (props.initialFocus !== undefined) {
    event.preventDefault();
    root.value?.querySelector<HTMLElement>(props.initialFocus)?.focus();
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    :title="title"
    :width="width"
    bare
    fit-content
    centered
    @open-auto-focus="onOpenFocus"
  >
    <div
      ref="root"
      :class="css.dialogFrame"
      data-no-commands
      data-layer
      @keydown="emit('keydown', $event)"
    >
      <DialogHead :title="title" />
      <div :class="[css.dialogFrame_body, bodyClass]">
        <slot />
      </div>
      <footer :class="css.dialogFrame_footer">
        <slot name="footer" />
      </footer>
    </div>
  </Dialog>
</template>

<style lang="scss" module="css">
.dialogFrame {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dialogFrame_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: $spacing-16;
  overflow-y: auto;
}

.dialogFrame_footer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  justify-content: flex-end;
  padding: $spacing-12 $spacing-16;
  border-top: 1px solid $color-border;
}
</style>
