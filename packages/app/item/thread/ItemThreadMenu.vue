<!-- The entries of a thread card's menu (`Activity / Comment menu`, F15), from its ⋯ or a right click on it: Edit, Quote reply, Copy link, then Delete… in red. Edit and Delete only where GitHub says the user may (K1b), Quote reply only where the composer takes a comment; the description has no Delete. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Link, Pencil, TextQuote, Trash2 } from 'lucide-vue-next';

import MenuItem from '@/components/MenuItem.vue';
import MenuSeparator from '@/components/MenuSeparator.vue';

import * as l from './ItemThreadMenu.loc.js';

defineProps<{
  canEdit: boolean;
  /** The composer takes a comment: not on a locked conversation or an archived repository. */
  canQuote: boolean;
  canDelete?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  quoteReply: [];
  copyLink: [];
  /** Asks first: GitHub keeps no copy. */
  delete: [];
}>();

const t = useTranslate();
</script>

<template>
  <MenuItem
    v-if="canEdit"
    :icon="Pencil"
    @select="emit('edit')"
    >{{ t(l.edit) }}</MenuItem
  >
  <MenuItem
    v-if="canQuote"
    :icon="TextQuote"
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
      :class="css.itemThreadMenu_delete"
      :icon="Trash2"
      @select="emit('delete')"
      >{{ t(l.delete) }}</MenuItem
    >
  </template>
</template>

<style lang="scss" module="css">
.itemThreadMenu_delete {
  --menu-item-icon-color: #{$color-red};

  color: $color-red;
}
</style>
