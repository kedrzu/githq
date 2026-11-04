<!-- A commit's pull request (state and number) and CI mark, in its row in the graph and on a branch in the list beside it (git-client D18, CH3, CH12). While they are not known yet an empty bar stands in for them, never a blank; a commit with neither shows nothing. `linked`, the pull request is a link to it: a plain click asks for it to be opened, as any item opens, one with a modifier is the browser's, and no click reaches what the marks sit in. -->
<script lang="ts" setup>
import type { StatusState } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';
import { computed } from 'vue';

import { getItemPagePath, parseItemUrl } from '@/item/itemRoutes.js';
import type { ItemReference } from '@/item/itemRoutes.js';

import CommitPullRequestIcon from './CommitPullRequestIcon.vue';
import * as l from './CommitStateMarks.loc.js';
import type { CommitState } from './CommitTypes.js';
import { getCiTone } from './getCiTone.js';
import type { CiTone } from './getCiTone.js';

const props = withDefaults(
  defineProps<{
    /** `undefined` while not known yet. */
    state: CommitState | undefined;
    /** `false`: the CI alone, as the default branch's row in the list (CH3). */
    withPullRequest?: boolean;
    /** The pull request is a link; not where the marks sit in a row that is itself a choice, as in the list (CH3). */
    linked?: boolean;
  }>(),
  { withPullRequest: true },
);

const emit = defineEmits<{
  /** A plain click on the link. */
  openPullRequest: [reference: ItemReference];
}>();

interface CiLook {
  readonly icon: LucideIcon;
  readonly tone: CiTone;
  readonly label: string;
}

const t = useTranslate();

const ci = computed(() => (props.state?.ci ? getCiLook(props.state.ci) : null));
const pullRequest = computed(() => (props.withPullRequest ? (props.state?.pullRequest ?? null) : null));
/** Found by its address, not its number: a fork's commit answers with its upstream's pull request. */
const reference = computed(() => (props.linked && pullRequest.value ? parseItemUrl(pullRequest.value.url) : null));

function onPullRequestClick(event: MouseEvent) {
  if (!reference.value) {
    return;
  }

  event.stopPropagation();
  if (event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }

  event.preventDefault();
  emit('openPullRequest', reference.value);
}

function getCiLook(state: StatusState): CiLook {
  const tone = getCiTone(state);
  switch (tone) {
    case 'success':
      return { icon: CircleCheck, tone, label: t(l.checksPassing) };
    case 'danger':
      return { icon: CircleX, tone, label: t(l.checksFailing) };
    case 'warning':
      return { icon: LoaderCircle, tone, label: t(l.checksRunning) };
    default:
      return assertNever(tone);
  }
}
</script>

<template>
  <span
    v-if="state === undefined"
    :class="css.commitStateMarks"
    role="img"
    :aria-label="t(l.notKnownYet)"
  >
    <span :class="css.commitStateMarks_unknownBar" />
    <span :class="[css.commitStateMarks_unknownBar, css.commitStateMarks_unknownBar_short]" />
  </span>
  <span
    v-else-if="pullRequest || ci"
    :class="css.commitStateMarks"
  >
    <component
      :is="reference ? 'a' : 'span'"
      v-if="pullRequest"
      :class="[css.commitStateMarks_pullRequest, reference && css.commitStateMarks_pullRequest_link]"
      :href="reference ? getItemPagePath(reference, 'pullRequest') : undefined"
      @click="onPullRequestClick"
    >
      <CommitPullRequestIcon :pull-request="pullRequest" />
      #{{ pullRequest.number }}
    </component>
    <component
      :is="ci.icon"
      v-if="ci"
      :class="[css.commitStateMarks_mark, css.commitStateMarks_ci, css[`commitStateMarks_mark_${ci.tone}`]]"
      role="img"
      :aria-label="ci.label"
    />
  </span>
</template>

<style lang="scss" module="css">
.commitStateMarks {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
}

.commitStateMarks_pullRequest {
  display: inline-flex;
  flex: none;
  gap: $spacing-5;
  align-items: center;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-2;
  white-space: nowrap;
}

.commitStateMarks_pullRequest_link {
  @include focus-ring;

  text-decoration: none;

  &:hover {
    color: $color-fg;
    text-decoration: underline;
  }
}

.commitStateMarks_mark {
  flex: none;
  width: 13px;
  height: 13px;
}

.commitStateMarks_mark_success {
  color: $color-green;
}

// A passing check is the common case: quieter than the marks that need the eye.
.commitStateMarks_ci.commitStateMarks_mark_success {
  opacity: 0.7;
}

.commitStateMarks_mark_danger {
  color: $color-red;
}

.commitStateMarks_mark_warning {
  color: $color-amber;
}

// Not known yet (CH34): an empty bar where the pull request and CI go, so it never reads as "has none".
.commitStateMarks_unknownBar {
  width: 30px;
  height: 6px;
  background: $color-bg-3;
  border-radius: 3px;
}

.commitStateMarks_unknownBar_short {
  width: 12px;
}
</style>
