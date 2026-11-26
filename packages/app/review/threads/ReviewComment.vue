<!-- A comment of a code thread (`Review / Comment`), wherever code threads show — code review's diff (`ReviewThreadBox`), a pull request's thread (`ItemThreadCodeThread`) — and a reply on its way (`ReviewSentComment`): flat on the thread's page colour, laid out as on GitHub: a header row — the avatar, who, how long ago with a link to it on GitHub, "· edited" once changed, "Pending · in your draft" while only the viewer sees it (`Review / Comment · pending`), "Sending…" while on its way — then, under it at full width from the header's left edge, what it says in the card text colour, as GitHub rendered it, or as typed until GitHub has it, dimmed while on its way. Given the view's comment actions (`actions`), its ⋯ ends the header row (as tall without it), shown on hover, while the focus is in it or while open (`Review / Comment · hovered`), and a right click on it opens the same menu — not on GitHub's rendering, which keeps the browser's own (`GitHubLinks`): Edit turns what it says into its editor in place under the header row (`Review / Comment · editing`, `CommentEditor`), then Quote reply (into its thread's reply, where the thread takes one: `canQuote`), Copy link and Delete, each where GitHub allows (`CommentMenu`); all done by the view's `useCommentActions`. An edit on its way shows its text dimmed, "Sending…", with no menu: GitHub has nothing to act on yet. It is its own padded box, edge to edge of its thread's card, with a 1 px divider above it after the first of its thread (a reply on its way too), so its root covers the area between dividers; its attributes (an anchor's `id`, a reading stop's) go on that root, which the editor stays inside, and so does `data-cursor-comment`, its id, by which code review's cursor measures it and tells which comment the pointer is over (none on a reply on its way). The comment code review's cursor is on (`current`) is tinted over its whole box (`current-tint`), `aria-current`, and its menu shows Edit's and Quote reply's keys. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Ellipsis } from 'lucide-vue-next';
import { computed, useTemplateRef, watchPostEffect } from 'vue';

import CommentEditor from '@/comments/CommentEditor.vue';
import CommentMenu from '@/comments/CommentMenu.vue';
import Avatar from '@/components/Avatar.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import IconButton from '@/components/IconButton.vue';
import Menu from '@/components/Menu.vue';
import GitHubHtml from '@/item/GitHubHtml.vue';
import { useNow } from '@/services/useNow.js';
import type { ItemUser } from '@/store/ItemTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import * as l from './ReviewComment.loc.js';
import type { ReviewCommentActions } from './ReviewCommentActions.js';
import ReviewPendingPill from './ReviewPendingPill.vue';

// The root is the context menu's; an anchor's `id` and a reading stop's attributes belong on the comment itself.
// Bound after its own `aria-current`, so a pull request's thread, which marks its comments itself, sets it.
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** `null` for an account that no longer exists. */
  author: ItemUser | null;
  createdAt: string;
  /** On GitHub, which its age links to; none for one on its way there. */
  url?: string;
  edited?: boolean;
  /** Still in the viewer's draft review: "Pending · in your draft". */
  inDraft?: boolean;
  /** GitHub's rendering, sanitized by GitHub. */
  html?: string;
  /** As typed, while GitHub has not rendered it: instead of {@link html}. */
  text?: string;
  /** On its way to GitHub: "Sending…" and its text dimmed. */
  sending?: boolean;
  /** What the view does with its comments; none, no ⋯ (a reply on its way). */
  actions?: ReviewCommentActions | null;
  /** The comment's id, which {@link actions} go by. */
  commentId?: string;
  /** The Markdown: what Edit starts from and Quote reply quotes. */
  body?: string;
  /** GitHub says the viewer may edit it. */
  canEdit?: boolean;
  /** GitHub says the viewer may delete it. */
  canDelete?: boolean;
  /** Its thread takes a reply (not one of the viewer's draft review): Quote reply is offered, into that reply. */
  canQuote?: boolean;
  /**
   * Code review's cursor is on it (D44). Elsewhere not given: a pull request's thread marks the comment under the reading
   * cursor itself, and its menu shows the keys where the reading cursor is shown.
   */
  current?: boolean;
}>();

/** How often "12m" moves on. */
const TICK_MS = 60_000;

const t = useTranslate();
const now = useNow(TICK_MS);
const moreRef = useTemplateRef<HTMLElement>('more');

const age = computed(() => formatAge(Date.parse(props.createdAt), now.value));
const login = computed(() => props.author?.login ?? t(l.ghost));
/** The view's actions, with the comment they act on. */
const acting = computed(() =>
  props.actions && props.commentId !== undefined
    ? { ...props.actions, id: props.commentId, body: props.body ?? '' }
    : null,
);
/** Its edit on its way to GitHub, as typed. */
const edit = computed(() => (acting.value ? acting.value.getEdit(acting.value.id) : null));
const shownText = computed(() => edit.value ?? props.text);
const onItsWay = computed(() => props.sending || edit.value !== null);
const editing = computed(() => acting.value !== null && acting.value.actions.editors.has(acting.value.id));
/** On its way, GitHub has nothing to act on yet. */
const menu = computed(() => (onItsWay.value || editing.value ? null : acting.value));

// The ⋯ is the header row's only button.
watchPostEffect(() => {
  if (menu.value && menu.value.actions.menuFocus === menu.value.id) {
    moreRef.value?.querySelector('button')?.focus();
  }
});
</script>

<template>
  <ContextMenu
    :disabled="!menu"
    :label="t(l.commentMenu)"
    @close-auto-focus="menu?.actions.onMenuClose($event)"
  >
    <div
      :data-cursor-comment="commentId"
      :aria-current="current ? 'true' : undefined"
      v-bind="$attrs"
      :class="[css.reviewComment, current && css.reviewComment_current]"
    >
      <p :class="css.reviewComment_header">
        <Avatar
          :name="login"
          :src="author?.avatarUrl"
          decorative
        />
        <span :class="css.reviewComment_author">{{ login }}</span>
        <time
          v-if="url === undefined"
          :class="css.reviewComment_age"
          :datetime="createdAt"
          >{{ age }}</time
        >
        <a
          v-else
          :class="css.reviewComment_age"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t(l.openOnGitHub, { age })"
          :title="t(l.openOnGitHub, { age })"
          ><time :datetime="createdAt">{{ age }}</time></a
        >
        <span
          v-if="edited"
          :class="css.reviewComment_note"
          >{{ t(l.edited) }}</span
        >
        <ReviewPendingPill v-if="inDraft" />
        <span
          v-else-if="onItsWay"
          :class="css.reviewComment_note"
          >{{ t(l.sending) }}</span
        >
        <span :class="css.reviewComment_spacer" />
        <span
          v-if="menu"
          ref="more"
          :class="css.reviewComment_more"
        >
          <Menu
            :open="menu.actions.openMenu === menu.id"
            align="end"
            :label="t(l.commentMenu)"
            @update:open="menu.actions.setMenuOpen(menu.id, $event)"
            @close-auto-focus="menu.actions.onMenuClose($event)"
          >
            <template #trigger>
              <IconButton
                :icon="Ellipsis"
                :label="t(l.commentMenu)"
              />
            </template>
            <CommentMenu
              :can-edit="canEdit ?? false"
              :can-quote="canQuote ?? false"
              :can-delete="canDelete"
              :shortcuts="current || undefined"
              @edit="menu.actions.startEdit(menu.id, menu.body)"
              @quote-reply="menu.quote(menu.id, menu.body)"
              @copy-link="url !== undefined && menu.actions.copyLink(url)"
              @delete="menu.actions.askDelete(menu.id)"
            />
          </Menu>
        </span>
      </p>
      <CommentEditor
        v-if="editing && acting"
        :class="css.reviewComment_measure"
        inline
        :text="acting.actions.editors.get(acting.id)?.text ?? ''"
        :author="author"
        :repository="acting.repository"
        :item-number="acting.itemNumber"
        :people="acting.people"
        :reason="acting.actions.getFailure(acting.id)"
        :autofocus="acting.actions.focusedEditor === acting.id"
        :changed="acting.actions.isChanged(acting.id)"
        :asking="acting.actions.asking === acting.id"
        @update:text="acting.actions.setText(acting.id, $event)"
        @update:asking="acting.actions.setAsking(acting.id, $event)"
        @save="acting.actions.saveEdit(acting.id, acting.body)"
        @cancel="acting.actions.cancelEdit(acting.id)"
      />
      <!-- `v-text`: text only, without the template's whitespace around it, which `pre-wrap` would show. -->
      <p
        v-else-if="shownText !== undefined"
        :class="[css.reviewComment_measure, css.reviewComment_typed, onItsWay && css.reviewComment_typed_sending]"
        v-text="shownText"
      />
      <GitHubHtml
        v-else
        :class="[css.reviewComment_measure, css.reviewComment_text]"
        :html="html ?? ''"
      />
    </div>
    <template #content>
      <CommentMenu
        v-if="menu"
        :can-edit="canEdit ?? false"
        :can-quote="canQuote ?? false"
        :can-delete="canDelete"
        :shortcuts="current || undefined"
        @edit="menu.actions.startEdit(menu.id, menu.body)"
        @quote-reply="menu.quote(menu.id, menu.body)"
        @copy-link="url !== undefined && menu.actions.copyLink(url)"
        @delete="menu.actions.askDelete(menu.id)"
      />
    </template>
  </ContextMenu>
</template>

<style lang="scss" module="css">
// Its own box, edge to edge of the thread, divider to divider: the header row, then what it says under it from the
// header's left edge. Padded itself, so its root (a reading stop's) covers the whole box.
.reviewComment {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  padding: $spacing-12;
}

// Under code review's cursor: a fill over its whole box, divider to divider, so nothing moves.
.reviewComment_current {
  background: $color-current-tint;
}

// Each comment after the first of its thread, a reply on its way too, is divided from the one above.
.reviewComment + .reviewComment {
  border-top: 1px solid $color-border;
}

// As tall with the ⋯ as without it.
.reviewComment_header {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  height: 20px;
  margin: 0;
  white-space: nowrap;
}

.reviewComment_author {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.reviewComment_age {
  @include focus-ring;

  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-decoration: none;
  border-radius: 3px;

  &:hover {
    color: $color-fg-2;
    text-decoration: underline;
  }
}

.reviewComment_note {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.reviewComment_spacer {
  flex: 1;
}

// Out of sight until the comment is hovered, the focus is in it or the menu is open; always there without a pointer.
.reviewComment_more {
  display: inline-flex;
  flex: none;
  opacity: 0;

  .reviewComment:hover &,
  .reviewComment:focus-within &,
  &:has([data-state='open']) {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
}

// What it says, as typed, rendered or being edited: no wider than reads well, while the header row, its ⋯ at the
// right, and the box fill the thread.
.reviewComment_measure {
  max-width: $review-text-width;
}

// What it says, in the card text colour.
.reviewComment_text {
  --github-html-color: #{$color-fg};
}

// As typed: GitHub has not rendered it. As GitHub's rendering of it will read.
.reviewComment_typed {
  margin: 0;
  font-family: $font-family-reading;
  font-size: $font-size-reading;
  line-height: $line-height-reading;
  color: $color-fg;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

// On its way, dimmed (not faded: it stays readable): GitHub's rendering replaces it once GitHub has it.
.reviewComment_typed_sending {
  color: $color-fg-dim;
}
</style>
