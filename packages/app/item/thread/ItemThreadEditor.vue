<!-- A comment or the description edited in place (`Activity / Comment · editing`, F15): the writer's avatar in the rail's gutter and the Markdown editor with the text, its border in the accent; Cancel (`Escape`) puts the card back unchanged, Update (`Mod+Enter`) saves. One GitHub did not take opens again with the text and why, under the editor. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleAlert } from 'lucide-vue-next';
import { onMounted, useTemplateRef } from 'vue';

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
  author: ItemUser | null;
  /** The description rather than a comment: "Update description", and it may be left empty. */
  description?: boolean;
  /** `owner/name`, which the editor's preview and suggestions are of. */
  repository: string;
  /** The thread's people, whom `@` suggests first. */
  people?: readonly ItemUser[];
  /** Why GitHub did not take it the last time it was saved; `null` when it was not refused. */
  reason?: EditFailureReason | null;
  /** Takes the focus as it opens: the user asked to edit it. */
  autofocus?: boolean;
}>();

const emit = defineEmits<{
  save: [];
  cancel: [];
}>();

const text = defineModel<string>('text', { required: true });

const SAVE_KEY = 'Mod+Enter';
const t = useTranslate();
const editTexts = useEditTexts();
const editorRef = useTemplateRef<InstanceType<typeof MarkdownEditor>>('editor');

onMounted(async () => {
  if (props.autofocus) {
    await editorRef.value?.focus();
  }
});

/** GitHub takes no empty comment. */
function canSave() {
  return props.description || text.value.trim() !== '';
}

function save() {
  if (canSave()) {
    emit('save');
  }
}
</script>

<template>
  <div :class="css.itemThreadEditor">
    <div :class="css.itemThreadEditor_gutter">
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
        :class="css.itemThreadEditor_editor"
        :repository="repository"
        :people="people"
        :label="description ? t(l.editDescription) : t(l.editComment)"
        @submit="save"
        @cancel="emit('cancel')"
      >
        <template #footer>
          <Button
            size="compact"
            kbd="Escape"
            keyshortcuts="Escape"
            @click="emit('cancel')"
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
            {{ description ? t(l.updateDescription) : t(l.updateComment) }}
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
