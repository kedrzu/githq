<!-- The entries of a thread card's menu (`Activity / Comment menu`, F15), from its ⋯ or a right click on it: Edit, Quote reply, Copy link, then Delete in red. Edit and Delete only where GitHub says the user may (K1b), Quote reply only where the composer takes a comment; the description has no Delete. Where the reading cursor's keys work (an item's page, F31), or on the comment under code review's cursor (`shortcuts`), Edit shows `W` and Quote reply `Q`; they act on the card under the cursor, not inside the open menu. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Link, Pencil, TextQuote, Trash2 } from 'lucide-vue-next';
import { computed } from 'vue';

import { keyOf } from '@/commands/keyOf.js';
import { editComment, quoteComment } from '@/commands/definitions/index.js';
import MenuItem from '@/components/MenuItem.vue';
import MenuSeparator from '@/components/MenuSeparator.vue';
import { useReadingCursorShown } from '@/reading/ReadingCursor.js';

import * as l from './CommentMenu.loc.js';

const props = withDefaults(
  defineProps<{
    canEdit: boolean;
    /** The composer takes a comment: not on a locked conversation or an archived repository. */
    canQuote: boolean;
    canDelete?: boolean;
    /** Show the keys beside Edit and Quote reply; by default, where a reading cursor is shown. */
    shortcuts?: boolean;
  }>(),
  // Absent is not `false`: the reading cursor decides.
  { shortcuts: undefined },
);

const emit = defineEmits<{
  edit: [];
  quoteReply: [];
  copyLink: [];
  /** Asks first: GitHub keeps no copy. */
  delete: [];
}>();

const t = useTranslate();
const cursorShown = useReadingCursorShown();

const keys = computed(() => props.shortcuts ?? cursorShown.value);
</script>

<template>
  <MenuItem
    v-if="canEdit"
    :icon="Pencil"
    :shortcut="keys ? keyOf(editComment) : undefined"
    @select="emit('edit')"
    >{{ t(l.edit) }}</MenuItem
  >
  <MenuItem
    v-if="canQuote"
    :icon="TextQuote"
    :shortcut="keys ? keyOf(quoteComment) : undefined"
    @select="emit('quoteReply')"
    >{{ t(l.quoteReply) }}</MenuItem
  >
  <MenuItem
    :icon="Link"
    @select="emit('copyLink')"
    >{{ t(l.copyLink) }}</MenuItem
  >
  <template v-if="canDelete">
    <MenuSeparator />
    <MenuItem
      :class="css.commentMenu_delete"
      :icon="Trash2"
      @select="emit('delete')"
      >{{ t(l.delete) }}</MenuItem
    >
  </template>
</template>

<style lang="scss" module="css">
.commentMenu_delete {
  --menu-item-icon-color: #{$color-red};

  color: $color-red;
}
</style>
