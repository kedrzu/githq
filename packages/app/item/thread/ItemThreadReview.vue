<!-- A submitted review on an item's thread (`Activity / Review`, F14): the reviewer's avatar in the gutter and a card whose head says the verdict in its colour — approved in green, requested changes in red, reviewed dim — when, and "2 threads · 1 resolved"; then the summary, each thread it started still open (`ItemThreadCodeThread`) and those resolved, each folded to its row (`ItemThreadResolvedRow`) — saying its first line after the file where another has the same file — until opened, Hide folding it again — with nothing written and no threads, the head alone. A dismissed review says what it was ("requested changes · dismissed") and folds to its head: "Show review" opens it, "Hide review" folds it again. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, ref } from 'vue';

import Button from '@/components/Button.vue';
import type { ItemUser } from '@/store/ItemTypes.js';

import GitHubHtml from '../GitHubHtml.vue';
import type { ThreadReview } from './buildThread.js';
import type { CodeThreadReplies } from './CodeThreadReplies.js';
import * as l from './ItemThreadReview.loc.js';
import ItemThreadCard from './ItemThreadCard.vue';
import ItemThreadCodeThread from './ItemThreadCodeThread.vue';
import ItemThreadResolvedRow from './ItemThreadResolvedRow.vue';

const props = defineProps<{
  entry: ThreadReview;
  /** Epoch ms the age is counted to. */
  now: number;
  /** Who is signed in: the reply bands' avatar. */
  viewer?: ItemUser | null;
  /** The viewer's replies in its threads; a resolved one being replied to shows opened. */
  replies?: CodeThreadReplies | null;
}>();

const emit = defineEmits<{
  /** "Reply…" was clicked on a thread. */
  reply: [threadId: string];
  /** Resolve thread, or Unresolve, on a thread. */
  setResolved: [threadId: string, resolved: boolean];
  /** A resolved thread was opened from its row, or folded to it again by Hide: drawn anew in its place. */
  toggled: [threadId: string];
}>();

const t = useTranslate();
/**
 * The resolved threads the user opened (`true`) or hid (`false`); the others show opened while a reply is written in
 * them. One hidden stays folded with its reply on its way, kept in the writing until opened again.
 */
const opened = ref<ReadonlyMap<string, boolean>>(new Map());
/** A dismissed review the user opened. */
const shown = ref(false);

const dismissed = computed(() => props.entry.review.state === 'DISMISSED');
const verdict = computed(() => {
  const { review, dismissedFrom } = props.entry;
  switch (review.state) {
    case 'APPROVED':
      return { text: t(l.approved), tone: 'approved' };
    case 'CHANGES_REQUESTED':
      return { text: t(l.changesRequested), tone: 'changesRequested' };
    case 'COMMENTED':
      return { text: t(l.commented), tone: null };
    case 'DISMISSED':
      return { text: getDismissedText(dismissedFrom), tone: null };
    default:
      return assertNever(review.state);
  }
});
const counts = computed(() => {
  const { threads, resolved } = props.entry;
  const total = threads.length + resolved.length;
  if (total === 0) {
    return null;
  }

  const all = t(l.threads, { count: total });
  return resolved.length === 0 ? all : t(l.threadsResolved, { threads: all, resolved: resolved.length });
});
/** The files of more than one resolved thread: their rows say their first lines too, so they can be told apart. */
const sharedPaths = computed(() => {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const { path } of props.entry.resolved) {
    (seen.has(path) ? shared : seen).add(path);
  }

  return shared;
});
/**
 * Nothing written and no threads, there is no body: the head alone. A dismissed review shows once opened, or while a
 * reply is written in one of its threads.
 */
const bodyShown = computed(() => {
  const { review, threads, resolved } = props.entry;
  if (!review.bodyHtml && threads.length === 0 && resolved.length === 0) {
    return false;
  }

  return !dismissed.value || shown.value || [...threads, ...resolved].some(thread => props.replies?.get(thread.id));
});

function getDismissedText(before: ThreadReview['dismissedFrom']) {
  switch (before) {
    case 'APPROVED':
      return t(l.approvedDismissed);
    case 'CHANGES_REQUESTED':
      return t(l.changesRequestedDismissed);
    default:
      return t(l.dismissed);
  }
}

function isOpened(threadId: string) {
  return opened.value.get(threadId) ?? props.replies?.get(threadId) != null;
}

/** Resolve always folds the thread to its row, however it was opened before. */
function setResolved(threadId: string, resolved: boolean) {
  if (resolved) {
    const next = new Map(opened.value);
    next.delete(threadId);
    opened.value = next;
  }

  emit('setResolved', threadId, resolved);
}

function toggle(threadId: string, open: boolean) {
  opened.value = new Map(opened.value).set(threadId, open);
  emit('toggled', threadId);
}
</script>

<template>
  <ItemThreadCard
    :author="entry.review.author"
    :created-at="entry.review.submittedAt"
    :now="now"
  >
    <template #verdict>
      <span :class="[css.itemThreadReview_verdict, verdict.tone && css[`itemThreadReview_verdict_${verdict.tone}`]]">{{
        verdict.text
      }}</span>
    </template>
    <template #aside>
      <Button
        v-if="dismissed"
        variant="link"
        tone="accent"
        :class="css.itemThreadReview_show"
        :aria-expanded="shown"
        @click="shown = !shown"
      >
        {{ shown ? t(l.hideReview) : t(l.showReview) }}
      </Button>
      <span
        v-else-if="counts !== null"
        :class="css.itemThreadReview_counts"
        >{{ counts }}</span
      >
    </template>
    <template
      v-if="bodyShown"
      #default
    >
      <div :class="css.itemThreadReview_body">
        <GitHubHtml
          v-if="entry.review.bodyHtml"
          :class="css.itemThreadReview_text"
          :html="entry.review.bodyHtml"
        />
        <ItemThreadCodeThread
          v-for="thread in entry.threads"
          :key="thread.id"
          :thread="thread"
          :viewer="viewer"
          :replies="replies"
          @reply="emit('reply', thread.id)"
          @set-resolved="setResolved(thread.id, $event)"
        />
        <template
          v-for="thread in entry.resolved"
          :key="thread.id"
        >
          <ItemThreadCodeThread
            v-if="isOpened(thread.id)"
            :thread="thread"
            :viewer="viewer"
            :replies="replies"
            @hide="toggle(thread.id, false)"
            @reply="emit('reply', thread.id)"
            @set-resolved="setResolved(thread.id, $event)"
          />
          <ItemThreadResolvedRow
            v-else
            :thread="thread"
            :says="sharedPaths.has(thread.path) ? 'both' : 'path'"
            @click="toggle(thread.id, true)"
          />
        </template>
      </div>
    </template>
  </ItemThreadCard>
</template>

<style lang="scss" module="css">
.itemThreadReview_verdict {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemThreadReview_verdict_approved {
  color: $color-green;
}

.itemThreadReview_verdict_changesRequested {
  color: $color-red;
}

.itemThreadReview_counts {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.itemThreadReview_show {
  font-size: $font-size-xs;
}

.itemThreadReview_body {
  display: flex;
  flex-direction: column;
  gap: $spacing-14;
}

.itemThreadReview_text {
  --github-html-font-size: #{$font-size-reading};
  --github-html-line-height: #{$line-height-reading};
  --github-html-color: #{$color-fg};
}
</style>
