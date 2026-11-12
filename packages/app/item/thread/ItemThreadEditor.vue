<!-- A comment or the description edited in place (`Activity / Comment · editing`, F15): the writer's avatar in the rail's gutter and the Markdown editor with the text, its border in the accent; Cancel (`Escape`) puts the card back unchanged, Update (`Mod+Enter`) saves. A reply in a code thread (`Activity / Code thread · replying`, F10) is the same editor without the gutter, in the thread's reply band: Cancel and Reply. One GitHub did not take opens again with the text and why, under the editor. Left with its text changed, it asks first in its footer (`Activity / Comment · editing, discard?`), as `MarkdownEditor` asks: Keep editing (`Escape`) or Discard (`Enter`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert } from 'lucide-vue-next';
import { computed, onMounted, useTemplateRef, watch } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import type { EditFailureReason } from '@/edits/EditTypes.js';
import { useEditTexts } from '@/edits/useEditTexts.js';
import type { ItemUser } from '@/store/ItemTypes.js';

import * as l from './ItemThreadEditor.loc.js';

const props = defineProps<{
  /** `null` for a deleted account. */
  author?: ItemUser | null;
  /**
   * What is written: a comment edited; the description — "Update description", and it may be left empty; a reply in a
   * code thread, with no gutter — its {@link saveLabel} says where it goes.
   */
  kind?: 'comment' | 'description' | 'reply';
  /** A reply's button: "Reply", or what code review's first key would do with it. */
  saveLabel?: string;
  /** `owner/name`, which the editor's preview and suggestions are of. */
  repository: string;
  /** The number of the item it is on, which `#` does not suggest. */
  itemNumber: number;
  /** The thread's people, whom `@` suggests first. */
  people?: readonly ItemUser[];
  /** Why GitHub did not take it the last time it was saved; `null` when it was not refused. */
  reason?: EditFailureReason | null;
  /** Takes the focus as it opens: the user asked to edit it. */
  autofocus?: boolean;
  /** Its text is not what the edit started with, or GitHub did not take it: leaving it asks first. */
  changed?: boolean;
}>();

const emit = defineEmits<{
  save: [];
  /** Left without saving: Cancel on an unchanged text, or Discard. */
  cancel: [];
}>();

const text = defineModel<string>('text', { required: true });
/** Its footer asks whether to discard the changes; the thread asks it too when the user leaves the item. */
const asking = defineModel<boolean>('asking', { default: false });

const SAVE_KEY = 'Mod+Enter';
const LABELS = {
  comment: { label: l.editComment, save: l.updateComment, question: l.discardComment },
  description: { label: l.editDescription, save: l.updateDescription, question: l.discardDescription },
  reply: { label: l.reply, save: l.reply, question: l.discardReply },
} as const;

const t = useTranslate();
const editTexts = useEditTexts();
const editorRef = useTemplateRef<InstanceType<typeof MarkdownEditor>>('editor');

const labels = computed(() => LABELS[props.kind ?? 'comment']);

onMounted(takeFocus);
// A reply box open already takes the focus again when asked to.
watch(() => props.autofocus, takeFocus);

/** A reply opens with the caret at the end, its buttons in view; an edit with its head in view. */
async function takeFocus() {
  if (props.autofocus) {
    await editorRef.value?.focus(props.kind === 'reply' ? 'end' : 'head');
  }
}

/** GitHub takes no empty comment. */
function canSave() {
  return props.kind === 'description' || text.value.trim() !== '';
}

function save() {
  if (canSave() && !asking.value) {
    emit('save');
  }
}

/** Escape and Cancel: an unchanged text closes, a changed one asks. */
function leave() {
  if (props.changed) {
    asking.value = true;
  } else {
    emit('cancel');
  }
}

// Taken here: the screen does not close the item, nor the modal blur the text.
function onEscape(event: KeyboardEvent) {
  event.preventDefault();
  leave();
}
</script>

<template>
  <div :class="kind === 'reply' ? css.itemThreadEditor_reply : css.itemThreadEditor">
    <div
      v-if="kind !== 'reply'"
      :class="css.itemThreadEditor_gutter"
    >
      <Avatar
        :name="author?.login ?? ''"
        :src="author?.avatarUrl"
        size="lg"
        decorative
      />
    </div>
    <div :class="css.itemThreadEditor_main">
      <MarkdownEditor
        ref="editor"
        v-model="text"
        v-model:asking="asking"
        :class="css.itemThreadEditor_editor"
        :repository="repository"
        :item-number="itemNumber"
        :people="people"
        :label="t(labels.label)"
        :question="t(labels.question)"
        :keep-label="t(l.keepEditing)"
        @submit="save"
        @cancel="onEscape"
        @discard="emit('cancel')"
      >
        <template #footer>
          <Button
            size="compact"
            kbd="Escape"
            keyshortcuts="Escape"
            @click="leave"
          >
            {{ t(l.cancel) }}
          </Button>
          <Button
            size="compact"
            variant="primary"
            :kbd="SAVE_KEY"
            :keyshortcuts="formatAriaKeyShortcuts(SAVE_KEY)"
            :unavailable="!canSave()"
            @click="save"
          >
            {{ saveLabel ?? t(labels.save) }}
          </Button>
        </template>
      </MarkdownEditor>
      <p
        v-if="reason"
        :class="css.itemThreadEditor_failed"
      >
        <CircleAlert
          :class="css.itemThreadEditor_failedIcon"
          aria-hidden="true"
        />
        <span role="alert">{{ editTexts.notSent(reason) }}</span>
      </p>
    </div>
  </div>
</template>

<style lang="scss" module="css">
// As a card of the thread: the avatar in the thread's gutter, level with the editor's head.
.itemThreadEditor {
  @include item-thread-row;
}

.itemThreadEditor_reply {
  display: flex;
  flex: 1;
  min-width: 0;
}

.itemThreadEditor_gutter {
  @include item-thread-gutter(38px);
}

.itemThreadEditor_main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-6;
  min-width: 0;
}

// Twice the class: the editor's own border comes from a stylesheet that may load after this one. In the accent while
// open, focused or not: it is what is being changed.
.itemThreadEditor_editor.itemThreadEditor_editor {
  border-color: $color-accent;
}

.itemThreadEditor_failed {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg;
}

.itemThreadEditor_failedIcon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-red;
}
</style>
