<!-- The latest comments of an opened item, newest last (D1): the last few, and "Show all N" for the rest — those not read yet are read from GitHub then. Each comment is GitHub's own rendering (`GitHubHtml`); the user's own on its way to GitHub shows dimmed, "sending…", as the text typed — GitHub renders it once it has it. Each comment GitHub has carries GitHub's anchor (`issuecomment-<id>`) as its `id`; the one the address's fragment names is shown — past "Show all", read from GitHub first when it is older than those read — and outlined while the address names it, as GitHub marks a linked comment. Bringing it into view is the router's (`shell/routeScroll.ts`). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, ref, watch } from 'vue';

import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import type { ItemComment, ItemComments } from '@/store/ItemDetailTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import GitHubHtml from './GitHubHtml.vue';
import * as l from './ItemActivity.loc.js';

const props = defineProps<{
  /** `null` while the detail is being read. */
  comments: ItemComments | null;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** Reads the comments not read yet; resolves once all are in. */
  loadAll: () => Promise<void>;
  /** The address's fragment without `#` (`''` for none): the comment it names is shown and marked. */
  linkedAnchor?: string;
}>();

/** How many of the newest comments show before "Show all". */
const LATEST = 3;
/** How GitHub's anchor of an issue or pull request comment starts. */
const COMMENT_ANCHOR = 'issuecomment-';

const t = useTranslate();
const expanded = ref(false);

const shown = computed(() => {
  const nodes = props.comments?.nodes ?? [];
  return expanded.value ? nodes : nodes.slice(-LATEST);
});
const hidden = computed(() => (props.comments ? props.comments.totalCount - shown.value.length : 0));
/** The anchors older comments were read from GitHub for: each is looked for there once, found or not. */
const readFor = new Set<string>();

// `immediate` with the default `pre` flush: the item is often in the local copy at mount, and the comment then is in
// the first render, the one the router's scroll looks for it in.
watch(() => [props.linkedAnchor, props.comments] as const, revealLinked, { immediate: true });

function revealLinked([anchor, comments]: readonly [string | undefined, ItemComments | null]) {
  if (!anchor?.startsWith(COMMENT_ANCHOR) || !comments) {
    return;
  }

  if (comments.nodes.some(comment => getCommentAnchor(comment) === anchor)) {
    if (!shown.value.some(comment => getCommentAnchor(comment) === anchor)) {
      expanded.value = true;
    }
  } else if (comments.olderCursor !== null && !readFor.has(anchor)) {
    readFor.add(anchor);
    void showAll();
  }
}

/** GitHub's anchor of the comment, its url's fragment; a comment on its way to GitHub has the item's url, and none. */
function getCommentAnchor(comment: ItemComment) {
  const hash = comment.url.indexOf('#');
  const fragment = hash === -1 ? '' : comment.url.slice(hash + 1);
  return fragment.startsWith(COMMENT_ANCHOR) ? fragment : undefined;
}

async function showAll() {
  await props.loadAll();
  expanded.value = true;
}

function isLinked(comment: ItemComment) {
  const anchor = getCommentAnchor(comment);
  return anchor !== undefined && anchor === props.linkedAnchor;
}
</script>

<template>
  <section :class="css.itemActivity">
    <h2 :class="css.itemActivity_header">
      <span :class="css.itemActivity_title">{{ t(l.latestActivity) }}</span>
      <Button
        v-if="hidden > 0"
        variant="link"
        size="sm"
        @click="showAll"
      >
        {{ t(l.showAll, { count: comments?.totalCount ?? 0 }) }}
      </Button>
    </h2>
    <p
      v-if="!comments"
      :class="css.itemActivity_note"
    >
      {{ t(l.loading) }}
    </p>
    <p
      v-else-if="comments.totalCount === 0"
      :class="css.itemActivity_note"
    >
      {{ t(l.noComments) }}
    </p>
    <ol
      v-else
      :class="css.itemActivity_list"
    >
      <li
        v-for="comment in shown"
        :id="getCommentAnchor(comment)"
        :key="comment.id"
        :class="[css.itemActivity_comment, { [css.itemActivity_commentLinked]: isLinked(comment) }]"
        :aria-current="isLinked(comment) ? 'location' : undefined"
      >
        <Avatar
          :name="comment.author?.login ?? t(l.deletedUser)"
          :src="comment.author?.avatarUrl"
          size="md"
          decorative
        />
        <div :class="css.itemActivity_body">
          <p :class="css.itemActivity_meta">
            <span :class="css.itemActivity_author">{{ comment.author?.login ?? t(l.deletedUser) }}</span>
            <time
              :class="css.itemActivity_age"
              :datetime="comment.createdAt"
              >{{ formatAge(Date.parse(comment.createdAt), now) }}</time
            >
            <span
              v-if="comment.lastEditedAt"
              :class="css.itemActivity_age"
              >{{ t(l.edited) }}</span
            >
            <span
              v-if="comment.pendingBody !== undefined"
              :class="css.itemActivity_age"
              >{{ t(l.sending) }}</span
            >
          </p>
          <!-- `v-text`: text only, without the template's whitespace around it, which `pre-wrap` would show. -->
          <p
            v-if="comment.pendingBody !== undefined"
            :class="css.itemActivity_pendingBody"
            v-text="comment.pendingBody"
          />
          <GitHubHtml
            v-else
            :html="comment.bodyHtml"
          />
        </div>
      </li>
    </ol>
  </section>
</template>

<style lang="scss" module="css">
.itemActivity {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
}

.itemActivity_header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: $font-size-xs;
  font-weight: $font-weight-normal;
}

.itemActivity_title {
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.itemActivity_note {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.itemActivity_list {
  display: flex;
  flex-direction: column;
  gap: $spacing-12;
  padding: 0;
  margin: 0;
  list-style: none;
}

.itemActivity_comment {
  position: relative;
  display: flex;
  gap: $spacing-10;
}

// Drawn outside the comment, halfway into the list's gap, so neither it nor its neighbours move.
.itemActivity_commentLinked::before {
  position: absolute;
  inset: -#{$spacing-6} -#{$spacing-8};
  pointer-events: none;
  content: '';
  border: 1px solid $color-accent;
  border-radius: $radius-lg;
}

.itemActivity_body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.itemActivity_meta {
  display: flex;
  gap: $spacing-6;
  align-items: baseline;
}

.itemActivity_author {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.itemActivity_age {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

// As typed, dimmed (not faded: it stays readable): GitHub's rendering replaces it once GitHub has it.
.itemActivity_pendingBody {
  margin: 0;
  font-size: $font-size-md;
  line-height: 20px;
  color: $color-fg-dim;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
