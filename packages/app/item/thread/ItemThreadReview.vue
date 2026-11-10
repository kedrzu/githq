<!-- A submitted review on an item's thread (`Activity / Review`, F14): the reviewer's avatar in the gutter and a card whose head says the verdict in its colour — approved in green, requested changes in red, reviewed dim — when, and "2 threads · 1 resolved"; then the summary, each thread it started still open (`ItemThreadCodeThread`) and those resolved, each folded to its row (`ItemThreadResolvedRow`) until opened, Hide folding it again. A dismissed review says what it was ("requested changes · dismissed") and folds to its head: "Show review" opens it, "Hide review" folds it again. -->
<script lang="ts" setup>
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, ref } from 'vue';

import type { ItemUser } from '@/store/ItemTypes.js';

import GitHubHtml from '../GitHubHtml.vue';
import type { ThreadReview } from './buildThread.js';
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
}>();

const emit = defineEmits<{
  /** "Reply…" was clicked on a thread. */
  reply: [threadId: string];
  /** Resolve thread, or Unresolve, on a thread. */
  setResolved: [threadId: string, resolved: boolean];
}>();

const t = useTranslate();
/** The resolved threads the user opened. */
const opened = ref<ReadonlySet<string>>(new Set());
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
const bodyShown = computed(() => !dismissed.value || shown.value);

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

function setOpened(id: string, open: boolean) {
  const next = new Set(opened.value);
  if (open) {
    next.add(id);
  } else {
    next.delete(id);
  }

  opened.value = next;
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
      <button
        v-if="dismissed"
        type="button"
        :class="css.itemThreadReview_show"
        :aria-expanded="shown"
        @click="shown = !shown"
      >
        {{ shown ? t(l.hideReview) : t(l.showReview) }}
      </button>
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
          @reply="emit('reply', thread.id)"
          @set-resolved="emit('setResolved', thread.id, $event)"
        />
        <template
          v-for="thread in entry.resolved"
          :key="thread.id"
        >
          <ItemThreadCodeThread
            v-if="opened.has(thread.id)"
            :thread="thread"
            :viewer="viewer"
            @hide="setOpened(thread.id, false)"
            @reply="emit('reply', thread.id)"
            @set-resolved="emit('setResolved', thread.id, $event)"
          />
          <ItemThreadResolvedRow
            v-else
            :thread="thread"
            @click="setOpened(thread.id, true)"
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
  @include focus-ring;

  padding: 0;
  font: inherit;
  font-size: $font-size-xs;
  color: $color-accent;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: 3px;

  &:hover {
    text-decoration: underline;
  }
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
