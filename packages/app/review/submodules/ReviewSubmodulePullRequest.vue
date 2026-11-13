<!-- A pull request in a submodule's repository carrying the submodule's new commit, as a raised card on a submodule block: a quiet label, the title as the block's strongest text, its state as a tinted pill and `owner/name#number`, and Open on the right. The whole card is one link, the title's (stretched over the card, so its name is the title alone), which opens the pull request in githq (inside `GitHubLinks`), or on GitHub when githq has no screen for it. -->
<script lang="ts" setup>
import type { CommitPullRequest } from '@githq/github/readCommitPullRequests.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowRight } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import CommitPullRequestIcon from '@/commits/CommitPullRequestIcon.vue';
import { getGitHubLinkTarget, GITHQ_LINK_ATTRIBUTE } from '@/shell/gitHubLinks.js';

import * as l from './ReviewSubmodulePullRequest.loc.js';

const props = defineProps<{
  pullRequest: CommitPullRequest;
  /** The submodule's repository, `owner/name`. */
  repository: string;
}>();

const t = useTranslate();
const router = useRouter();

/** githq's path, marked with GitHub's address, or GitHub's address in a new tab. */
const link = computed(() => {
  const { url } = props.pullRequest;
  // A pull request is never a workflow, the one address that depends on what is tracked.
  const target = getGitHubLinkTarget(url, { router, isTracked: () => true });
  return target
    ? { href: target.path, [GITHQ_LINK_ATTRIBUTE]: url }
    : { href: url, target: '_blank', rel: 'noopener noreferrer' };
});
</script>

<template>
  <div :class="css.reviewSubmodulePullRequest">
    <div :class="css.reviewSubmodulePullRequest_text">
      <span :class="css.reviewSubmodulePullRequest_label">{{ t(l.label) }}</span>
      <a
        :class="css.reviewSubmodulePullRequest_title"
        v-bind="link"
        >{{ pullRequest.title }}</a
      >
      <span :class="css.reviewSubmodulePullRequest_facts">
        <CommitPullRequestIcon
          :pull-request="pullRequest"
          pill
        />
        <span :class="css.reviewSubmodulePullRequest_reference">{{ repository }}#{{ pullRequest.number }}</span>
      </span>
    </div>
    <span
      :class="css.reviewSubmodulePullRequest_open"
      aria-hidden="true"
    >
      {{ t(l.open) }}
      <ArrowRight :class="css.reviewSubmodulePullRequest_arrow" />
    </span>
  </div>
</template>

<style lang="scss" module="css">
.reviewSubmodulePullRequest {
  position: relative;
  display: flex;
  gap: $spacing-16;
  align-items: center;
  padding: $spacing-12 $spacing-16;
  color: $color-fg;
  text-decoration: none;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &:hover {
    border-color: $color-border-2;
  }

  // The title's link is the card's: its focus ring is the card's.
  &:has(:focus-visible) {
    outline: 2px solid $color-focus;
    outline-offset: 1px;
  }
}

.reviewSubmodulePullRequest_text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-4;
  min-width: 0;
}

.reviewSubmodulePullRequest_label {
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.reviewSubmodulePullRequest_title {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  line-height: $line-height-tight;
  color: $color-fg;
  text-decoration: none;
  overflow-wrap: anywhere;
  outline: none;

  // Stretched over the card: a click anywhere on it is a click on the link.
  &::after {
    position: absolute;
    inset: 0;
    content: '';
    border-radius: $radius-lg;
  }

  .reviewSubmodulePullRequest:hover & {
    text-decoration: underline;
  }
}

.reviewSubmodulePullRequest_facts {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4 $spacing-10;
  align-items: center;
  margin-top: $spacing-2;
}

.reviewSubmodulePullRequest_reference {
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-2;
}

.reviewSubmodulePullRequest_open {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.reviewSubmodulePullRequest_arrow {
  width: 14px;
  height: 14px;
}
</style>
