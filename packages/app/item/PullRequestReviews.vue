<!-- The reviews of an opened pull request (F1–F4): each reviewer's latest review with when it was given, then those asked who have not answered yet. Where the user may, "Request" (`⇧R`) asks more people for a review: the repository's users, picked several at a time. -->
<script lang="ts" setup>
import type { PullRequestReviewState } from '@githq/github/generated.gen.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { Hourglass, UserPlus, Users } from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { EDIT_KEYS } from '@/commands/useEditCommands.js';
import Avatar from '@/components/Avatar.vue';
import Button from '@/components/Button.vue';
import Picker from '@/components/Picker.vue';
import type { PickerOption } from '@/components/Picker.vue';
import { getReviewRequestName } from '@/store/getReviewRequestName.js';
import type { PullRequestDetail } from '@/store/ItemDetailTypes.js';
import { formatAge } from '@/utils/formatAge.js';

import { getReviewVerdict } from './getReviewVerdict.js';
import type { ReviewVerdictTone } from './getReviewVerdict.js';
import * as l from './PullRequestReviews.loc.js';

const props = defineProps<{
  detail: PullRequestDetail;
  /** Epoch ms the ages are counted to. */
  now: number;
  /** Who can be asked for a review; without it no one is asked from here. */
  reviewerOptions?: readonly PickerOption[] | null;
}>();

const emit = defineEmits<{
  /** Reviews asked of these users. */
  request: [logins: readonly string[]];
}>();

interface ReviewerLine {
  key: string;
  name: string;
  avatarUrl: string | null;
  team: boolean;
  tone: ReviewVerdictTone;
  icon: LucideIcon;
  state: string;
  at: string | null;
}

const t = useTranslate();
const picking = ref(false);

/** Who can still be asked: not the author, not someone asked already. */
const askable = computed(() => {
  const asked = new Set(
    props.detail.reviewRequests.flatMap(request => (request.kind === 'user' ? [request.user.login] : [])),
  );
  const author = props.detail.item.author?.login;
  return (props.reviewerOptions ?? []).filter(option => option.value !== author && !asked.has(option.value));
});

defineExpose({
  /** Opens "Request"; `false` when the user can't ask for reviews here. */
  openPicker: () => {
    if (!props.reviewerOptions) {
      return false;
    }

    picking.value = true;
    return true;
  },
});

const lines = computed((): ReviewerLine[] => {
  const result: ReviewerLine[] = [];
  const seen = new Set<string>();
  for (const review of props.detail.reviews) {
    const name = review.author?.login ?? t(l.deletedUser);
    seen.add(name);
    result.push({
      key: `review:${name}`,
      name,
      avatarUrl: review.author?.avatarUrl ?? null,
      team: false,
      ...describe(review.state),
      at: review.submittedAt,
    });
  }

  for (const request of props.detail.reviewRequests) {
    const name = getReviewRequestName(request);
    if (seen.has(name)) {
      continue;
    }

    result.push({
      key: `request:${name}`,
      name,
      avatarUrl: request.kind === 'user' ? request.user.avatarUrl : null,
      team: request.kind === 'team',
      tone: 'quiet',
      icon: Hourglass,
      state: t(l.requested),
      at: null,
    });
  }

  return result;
});

function describe(state: PullRequestReviewState): Pick<ReviewerLine, 'icon' | 'state' | 'tone'> {
  if (state === 'PENDING') {
    return { tone: 'quiet', icon: Hourglass, state: t(l.pending) };
  }

  const { tone, icon, label } = getReviewVerdict(state);
  return { tone, icon, state: t(label) };
}
</script>

<template>
  <section :class="css.pullRequestReviews">
    <h2 :class="css.pullRequestReviews_title">
      {{ t(l.reviews) }}
      <Picker
        v-if="reviewerOptions"
        v-model:open="picking"
        :label="t(l.requestReview)"
        :options="askable"
        :placeholder="t(l.filterReviewers)"
        multiple
        align="end"
        @apply="emit('request', $event.added)"
      >
        <template #trigger>
          <Button
            variant="ghost"
            size="sm"
            :icon="UserPlus"
            :kbd="EDIT_KEYS.reviewers"
            :keyshortcuts="EDIT_KEYS.reviewers"
          >
            {{ t(l.request) }}
          </Button>
        </template>
      </Picker>
    </h2>
    <p
      v-if="lines.length === 0"
      :class="css.pullRequestReviews_none"
    >
      {{ t(l.none) }}
    </p>
    <ul
      v-else
      :class="css.pullRequestReviews_list"
    >
      <li
        v-for="line in lines"
        :key="line.key"
        :class="css.pullRequestReviews_reviewer"
      >
        <Users
          v-if="line.team"
          :class="css.pullRequestReviews_team"
          aria-hidden="true"
        />
        <Avatar
          v-else
          :name="line.name"
          :src="line.avatarUrl"
          size="sm"
          decorative
        />
        <span :class="css.pullRequestReviews_name">{{ line.name }}</span>
        <span :class="[css.pullRequestReviews_state, css[`pullRequestReviews_state_${line.tone}`]]">
          <component
            :is="line.icon"
            :class="css.pullRequestReviews_stateIcon"
            aria-hidden="true"
          />
          {{ line.state }}
        </span>
        <time
          v-if="line.at"
          :class="css.pullRequestReviews_age"
          :datetime="line.at"
          >{{ formatAge(Date.parse(line.at), now) }}</time
        >
      </li>
    </ul>
  </section>
</template>

<style lang="scss" module="css">
.pullRequestReviews {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

.pullRequestReviews_title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.pullRequestReviews_none {
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.pullRequestReviews_list {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: 0;
  margin: 0;
  list-style: none;
}

.pullRequestReviews_reviewer {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-sm;
  line-height: 18px;
}

.pullRequestReviews_team {
  width: 18px;
  height: 18px;
  padding: 2px;
  color: $color-fg-3;
}

.pullRequestReviews_name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg;
  white-space: nowrap;
}

.pullRequestReviews_state {
  display: inline-flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
}

.pullRequestReviews_state_approved {
  color: $color-green;
}

.pullRequestReviews_state_changes {
  color: $color-red;
}

.pullRequestReviews_state_quiet {
  color: $color-fg-dim;
}

.pullRequestReviews_stateIcon {
  width: 13px;
  height: 13px;
}

.pullRequestReviews_age {
  flex: none;
  min-width: 18px;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-align: right;
}
</style>
