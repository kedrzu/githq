<!-- The toolbar at the foot of the diff while the viewer has a draft review on the pull request (D28, `Review / Pending toolbar`, CR35, CR36): how many comments wait, what that means, and the way out. Writing comes later (D23), and with it Discard review… and Submit review… (⇧S): until then the one way out is finishing on GitHub. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, PencilLine } from 'lucide-vue-next';

import Button from '@/components/Button.vue';

import * as l from './ReviewPendingToolbar.loc.js';

defineProps<{
  commentCount: number;
  /** The pull request's files on GitHub, where the draft is finished. */
  githubUrl: string;
}>();

const t = useTranslate();
</script>

<template>
  <section
    :class="css.reviewPendingToolbar"
    :aria-label="t(l.label)"
  >
    <PencilLine
      :class="css.reviewPendingToolbar_icon"
      aria-hidden="true"
    />
    <span :class="css.reviewPendingToolbar_title">
      <strong :class="css.reviewPendingToolbar_count">{{ commentCount }}</strong>
      {{ t(l.pendingComments, { count: commentCount }) }}
    </span>
    <span :class="css.reviewPendingToolbar_note">{{ t(l.note) }}</span>
    <Button
      :class="css.reviewPendingToolbar_finish"
      size="sm"
      :icon="ArrowUpRight"
      :link="githubUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t(l.finishOnGitHub) }}
    </Button>
  </section>
</template>

<style lang="scss" module="css">
.reviewPendingToolbar {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: 44px;
  padding: 0 $spacing-8 0 14px;
  white-space: nowrap;
  background: rgba($color-amber, 0.1);
  border-top: 1px solid rgba($color-amber, 0.35);
}

.reviewPendingToolbar_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-amber;
}

.reviewPendingToolbar_title {
  flex: none;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-fg;
}

.reviewPendingToolbar_count {
  font-size: $font-size-md;
  font-weight: 700;
  color: $color-amber;
}

.reviewPendingToolbar_note {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-overflow: ellipsis;
}

// Twice the class: the button's own look comes from a stylesheet that may load after this one.
.reviewPendingToolbar .reviewPendingToolbar_finish {
  flex: none;
  color: $color-on-light;
  background: $color-amber;
  border-color: $color-amber;
}
</style>
