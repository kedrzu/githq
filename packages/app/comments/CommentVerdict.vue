<!-- A submitted review's verdict in its card's head (`Activity / Review`), wherever reviews are listed — an item's thread, code review's conversation: approved in green, requested changes in red, reviewed dim; a dismissed one says what it was when that is known ("requested changes · dismissed"). -->
<script lang="ts" setup>
import type { PullRequestReviewState } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed } from 'vue';

import * as l from './CommentVerdict.loc.js';

const props = defineProps<{
  state: Exclude<PullRequestReviewState, 'PENDING'>;
  /** What a dismissed review was before, as its dismissal says; `null` when not known. */
  dismissedFrom?: PullRequestReviewState | null;
}>();

const t = useTranslate();
const verdict = computed(() => {
  switch (props.state) {
    case 'APPROVED':
      return { text: t(l.approved), tone: 'approved' };
    case 'CHANGES_REQUESTED':
      return { text: t(l.changesRequested), tone: 'changesRequested' };
    case 'COMMENTED':
      return { text: t(l.commented), tone: null };
    case 'DISMISSED':
      return { text: getDismissedText(), tone: null };
    default:
      return assertNever(props.state);
  }
});

function getDismissedText() {
  switch (props.dismissedFrom) {
    case 'APPROVED':
      return t(l.approvedDismissed);
    case 'CHANGES_REQUESTED':
      return t(l.changesRequestedDismissed);
    default:
      return t(l.dismissed);
  }
}
</script>

<template>
  <span :class="[css.commentVerdict, verdict.tone && css[`commentVerdict_${verdict.tone}`]]">{{ verdict.text }}</span>
</template>

<style lang="scss" module="css">
.commentVerdict {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.commentVerdict_approved {
  color: $color-green;
}

.commentVerdict_changesRequested {
  color: $color-red;
}
</style>
