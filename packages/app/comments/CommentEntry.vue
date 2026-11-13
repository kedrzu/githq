<!-- One comment, or an item's description, wherever comments are listed (an item's thread, code review's conversation): its card (`CommentCard`) with what was written as GitHub rendered it — or as typed while on its way, dimmed, "Sending…" for its time — "edited" once changed, and its menu (`CommentMenu`): Edit, which turns the card into its editor in place (`CommentEditor`), Quote reply, Copy link and Delete…, each only where GitHub says the user may (K1b), all done by the list's `useCommentActions`. A comment on its way has no menu: GitHub has nothing to act on yet. A description with nothing written says so. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import GitHubHtml from '@/item/GitHubHtml.vue';
import type { ItemUser } from '@/store/ItemTypes.js';

import * as l from './CommentEntry.loc.js';
import CommentCard from './CommentCard.vue';
import CommentEditor from './CommentEditor.vue';
import CommentMenu from './CommentMenu.vue';
import type { CommentActions } from './useCommentActions.js';

const props = defineProps<{
  /** What the list does with its cards. */
  actions: CommentActions;
  /** The comment's id; `null` for the description. */
  id: string | null;
  /** `null` for a deleted account. */
  author: ItemUser | null;
  createdAt: string;
  /** Epoch ms the age is counted to. */
  now: number;
  /** GitHub's rendering, sanitized by GitHub. */
  html: string;
  /** The Markdown: what Edit starts from and Quote reply quotes. */
  body: string;
  /** As typed, while on its way to GitHub. */
  pendingBody?: string;
  /** On GitHub: Copy link. */
  url: string;
  edited?: boolean;
  /** The address's fragment names it: the accent border. */
  linked?: boolean;
  /** GitHub says the user may edit it. */
  canEdit?: boolean;
  /** GitHub says the user may delete it; never the description. */
  canDelete?: boolean;
  /** The composer takes a comment. */
  canQuote?: boolean;
  /** `owner/name`, which the editor's preview and suggestions are of. */
  repository: string;
  /** The number of the item it is on. */
  itemNumber: number;
  /** Whom `@` suggests first in the editor. */
  people?: readonly ItemUser[];
}>();

defineSlots<{
  /** Instead of GitHub's rendering, around it (the conversation's fold); not while on its way. */
  body?(): unknown;
}>();

const t = useTranslate();
</script>

<template>
  <CommentEditor
    v-if="actions.editors.has(id)"
    :text="actions.editors.get(id)?.text ?? ''"
    :author="author"
    :repository="repository"
    :item-number="itemNumber"
    :people="people"
    :reason="actions.getFailure(id)"
    :autofocus="actions.focusedEditor === id"
    :changed="actions.isChanged(id)"
    :asking="actions.asking === id"
    :kind="id === null ? 'description' : 'comment'"
    @update:text="actions.setText(id, $event)"
    @update:asking="actions.setAsking(id, $event)"
    @save="actions.saveEdit(id, body)"
    @cancel="actions.cancelEdit(id)"
  />
  <CommentCard
    v-else
    :author="author"
    :created-at="createdAt"
    :now="now"
    :edited="edited"
    :sending="pendingBody !== undefined"
    :menu-focused="actions.menuFocus === id"
    :linked="linked"
    :description="id === null"
    @menu-close="actions.onMenuClose"
  >
    <!-- `v-text`: text only, without the template's whitespace around it, which `pre-wrap` would show. -->
    <p
      v-if="pendingBody !== undefined"
      :class="[css.commentEntry_typed, css.commentEntry_pending]"
      v-text="pendingBody"
    />
    <slot
      v-else-if="$slots.body"
      name="body"
    />
    <GitHubHtml
      v-else-if="html"
      :class="css.commentEntry_text"
      :html="html"
    />
    <p
      v-else
      :class="css.commentEntry_note"
    >
      {{ t(l.noDescription) }}
    </p>
    <!-- On its way, a comment has nothing GitHub would act on yet; the description keeps Quote reply and Copy link. -->
    <template
      v-if="id === null || pendingBody === undefined"
      #menu
    >
      <CommentMenu
        :can-edit="(canEdit ?? false) && pendingBody === undefined"
        :can-quote="canQuote ?? false"
        :can-delete="id !== null && canDelete"
        @edit="actions.startEdit(id, body)"
        @quote-reply="actions.quote(body)"
        @copy-link="actions.copyLink(url)"
        @delete="id !== null && actions.askDelete(id)"
      />
    </template>
  </CommentCard>
</template>

<style lang="scss" module="css">
// GitHub's rendering, at the thread's reading size.
.commentEntry_text {
  --github-html-font-size: #{$font-size-reading};
  --github-html-line-height: #{$line-height-reading};
  --github-html-color: #{$color-fg};
}

// As typed: GitHub has not rendered it. As GitHub's rendering of it will read.
.commentEntry_typed {
  margin: 0;
  font-size: $font-size-reading;
  line-height: $line-height-reading;
  color: $color-fg;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

// On its way, dimmed (not faded: it stays readable): GitHub's rendering replaces it once GitHub has it.
.commentEntry_pending {
  color: $color-fg-dim;
}

.commentEntry_note {
  margin: 0;
  font-size: $font-size-md;
  color: $color-fg-dim;
}
</style>
