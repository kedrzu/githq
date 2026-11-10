<!-- The thread's last entry (I4): the viewer's avatar in the rail's gutter and the Markdown editor beside it, with the item's close or reopen button and Comment (`Mod+Enter`, dimmed while nothing is typed). An open issue closes as completed from its button (`⇧X`) and as not planned from the button's menu; an open pull request closes, a closed one reopens, a merged one has nothing to close. With text typed the close button reads "Close with comment": the comment goes first, then the close. What is typed is the item's draft (`text`). Where the user can't comment — the conversation locked to collaborators, the repository archived — one quiet line says so instead of the editor. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  Archive,
  CircleCheck,
  CircleDot,
  CircleSlash,
  GitPullRequest,
  GitPullRequestClosed,
  Lock,
} from 'lucide-vue-next';
import { computed, useTemplateRef } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { EDIT_KEYS } from '@/commands/useEditCommands.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import MenuItem from '@/components/MenuItem.vue';
import SplitButton from '@/components/SplitButton.vue';
import type { CloseReason, EditRequest } from '@/edits/EditTypes.js';
import type { Item, ItemUser } from '@/store/ItemTypes.js';

import * as l from './ItemThreadComposer.loc.js';

const props = defineProps<{
  item: Item;
  /** The signed-in user; `null` when no one is. */
  viewer: ItemUser | null;
  /** The user may comment; without it the editor only shows. */
  canComment: boolean;
  /** The user may close and reopen the item (K1b). */
  canClose: boolean;
  /** Why the user can't comment here, said instead of the editor; `null` when nothing stops them. */
  readOnly: 'archived' | 'locked' | null;
}>();

const emit = defineEmits<{
  /** A comment, a close or a reopen; a close with a comment sends the comment first. */
  edit: [request: EditRequest];
}>();

/** What is typed and not posted yet. */
const text = defineModel<string>('text', { default: '' });

const SUBMIT_KEY = 'Mod+Enter';
const t = useTranslate();
const rootRef = useTemplateRef<HTMLElement>('root');
const editorRef = useTemplateRef<InstanceType<typeof MarkdownEditor>>('editor');

const typed = computed(() => text.value.trim() !== '');
/** A merged pull request has nothing to close or reopen. */
const stateAction = computed(() => {
  const { item } = props;
  if (!props.canClose || (item.kind === 'pullRequest' && item.merged)) {
    return null;
  }

  return item.state === 'OPEN' ? 'close' : 'reopen';
});

defineExpose({
  /** Brings the composer into view and puts the cursor in it. */
  focus: async () => {
    rootRef.value?.scrollIntoView({ block: 'nearest' });
    await editorRef.value?.focus();
  },
});

function submit() {
  const body = text.value.trim();
  if (body) {
    emit('edit', { kind: 'comment', body, keptInThread: true });
    text.value = '';
  }
}

function close(reason: CloseReason) {
  submit();
  emit('edit', { kind: 'close', reason });
}
</script>

<template>
  <div
    ref="root"
    :class="[css.itemThreadComposer, readOnly && css.itemThreadComposer_readOnly]"
  >
    <div :class="css.itemThreadComposer_gutter">
      <Avatar
        v-if="viewer"
        :name="viewer.login"
        :src="viewer.avatarUrl"
        size="lg"
        decorative
      />
    </div>
    <p
      v-if="readOnly"
      :class="css.itemThreadComposer_note"
    >
      <component
        :is="readOnly === 'locked' ? Lock : Archive"
        :class="css.itemThreadComposer_noteIcon"
        aria-hidden="true"
      />
      {{ readOnly === 'locked' ? t(l.locked) : t(l.archived, { repository: item.repository.nameWithOwner }) }}
    </p>
    <MarkdownEditor
      v-else
      ref="editor"
      v-model="text"
      :class="css.itemThreadComposer_editor"
      :repository="item.repository.nameWithOwner"
      :label="t(l.comment)"
      :placeholder="t(l.placeholder)"
      :readonly="!canComment"
      @submit="submit"
    >
      <template
        v-if="canComment"
        #footer
      >
        <SplitButton
          v-if="stateAction === 'close' && item.kind === 'issue'"
          :class="css.itemThreadComposer_completed"
          :icon="CircleCheck"
          :kbd="EDIT_KEYS.state"
          :keyshortcuts="EDIT_KEYS.state"
          :menu-label="t(l.moreWaysToClose)"
          @click="close('COMPLETED')"
        >
          {{ typed ? t(l.closeWithComment) : t(l.closeIssue) }}
          <template #menu>
            <MenuItem
              :class="css.itemThreadComposer_completedItem"
              :icon="CircleCheck"
              @select="close('COMPLETED')"
              >{{ t(l.closeCompleted) }}</MenuItem
            >
            <MenuItem
              :icon="CircleSlash"
              @select="close('NOT_PLANNED')"
              >{{ t(l.closeNotPlanned) }}</MenuItem
            >
          </template>
        </SplitButton>
        <Button
          v-else-if="stateAction === 'close'"
          :class="css.itemThreadComposer_closed"
          size="compact"
          :icon="GitPullRequestClosed"
          :kbd="EDIT_KEYS.state"
          :keyshortcuts="EDIT_KEYS.state"
          @click="close('COMPLETED')"
        >
          {{ typed ? t(l.closeWithComment) : t(l.closePullRequest) }}
        </Button>
        <Button
          v-else-if="stateAction === 'reopen'"
          :class="css.itemThreadComposer_open"
          size="compact"
          :icon="item.kind === 'issue' ? CircleDot : GitPullRequest"
          :kbd="EDIT_KEYS.state"
          :keyshortcuts="EDIT_KEYS.state"
          @click="emit('edit', { kind: 'reopen' })"
        >
          {{ item.kind === 'issue' ? t(l.reopenIssue) : t(l.reopenPullRequest) }}
        </Button>
        <Button
          size="compact"
          variant="primary"
          :kbd="SUBMIT_KEY"
          :keyshortcuts="formatAriaKeyShortcuts(SUBMIT_KEY)"
          :unavailable="!typed"
          @click="submit"
        >
          {{ t(l.comment) }}
        </Button>
      </template>
    </MarkdownEditor>
  </div>
</template>

<style lang="scss" module="css">
// As a card of the thread: the avatar in the thread's gutter, level with the editor's head.
.itemThreadComposer {
  display: flex;
  gap: $item-thread-gutter-gap;
}

.itemThreadComposer_gutter {
  display: flex;
  flex: none;
  align-items: center;
  width: $item-thread-gutter-width;
  height: 38px;
}

// One line: the avatar level with it.
.itemThreadComposer_readOnly {
  align-items: center;

  .itemThreadComposer_gutter {
    height: auto;
  }
}

.itemThreadComposer_editor {
  flex: 1;
  min-width: 0;
}

// Its fill hides the rail running behind it.
.itemThreadComposer_note {
  display: flex;
  flex: 1;
  gap: $spacing-10;
  align-items: center;
  min-width: 0;
  padding: 11px $spacing-14;
  margin: 0;
  font-size: $font-size-sm;
  color: $color-fg-2;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.itemThreadComposer_noteIcon {
  flex: none;
  width: 14px;
  height: 14px;
}

// The action's icon in the colour of the state it leads to.
.itemThreadComposer_completed {
  --button-icon-color: #{$color-purple};
}

.itemThreadComposer_completedItem {
  --menu-item-icon-color: #{$color-purple};
}

.itemThreadComposer_closed {
  --button-icon-color: #{$color-red};
}

.itemThreadComposer_open {
  --button-icon-color: #{$color-green};
}
</style>
