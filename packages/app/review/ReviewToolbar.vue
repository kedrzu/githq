<!-- The review's toolbar (D24): back, the pull request's state, repository, number and title, and at the right the view options, under a button naming what's on (split or unified, whitespace hidden, for every pull request: D4, D14), and github.com. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowLeft,
  ChevronDown,
  Columns2,
  Github,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Rows2,
} from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Popover from '@/components/Popover.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import Switch from '@/components/Switch.vue';
import type { ItemReference } from '@/item/itemRoutes.js';
import type { Item } from '@/store/ItemTypes.js';

import type { DiffLayout } from './diff/buildDiffRows.js';
import * as l from './ReviewToolbar.loc.js';

const props = defineProps<{
  reference: ItemReference;
  /** The pull request's row, once known. */
  item: Item | null;
  githubUrl: string;
}>();

const emit = defineEmits<{
  back: [];
}>();

const layout = defineModel<DiffLayout>('layout', { required: true });
const hideWhitespace = defineModel<boolean>('hideWhitespace', { required: true });

const t = useTranslate();

const state = computed(() => {
  const { item } = props;
  if (item?.kind !== 'pullRequest') {
    return { icon: GitPullRequest, tone: 'open' };
  }

  if (item.merged) {
    return { icon: GitMerge, tone: 'merged' };
  }

  if (item.state !== 'OPEN') {
    return { icon: GitPullRequestClosed, tone: 'closed' };
  }

  return item.isDraft ? { icon: GitPullRequestDraft, tone: 'draft' } : { icon: GitPullRequest, tone: 'open' };
});
const layoutOptions = computed((): SegmentedTabsOption<DiffLayout>[] => [
  { value: 'split', label: t(l.split), icon: Columns2 },
  { value: 'unified', label: t(l.unified), icon: Rows2 },
]);
</script>

<template>
  <header :class="css.reviewToolbar">
    <IconButton
      :icon="ArrowLeft"
      :label="t(l.back)"
      @click="emit('back')"
    />
    <component
      :is="state.icon"
      :class="[css.reviewToolbar_state, css[`reviewToolbar_state_${state.tone}`]]"
      aria-hidden="true"
    />
    <span :class="css.reviewToolbar_repository">{{ reference.owner }}/{{ reference.name }}</span>
    <span :class="css.reviewToolbar_number">#{{ reference.number }}</span>
    <h1 :class="css.reviewToolbar_title">{{ item?.title }}</h1>
    <span :class="css.reviewToolbar_where">{{ t(l.review) }}</span>
    <span :class="css.reviewToolbar_spacer" />
    <Popover
      :label="t(l.viewOptions)"
      align="end"
      flush
    >
      <template #trigger>
        <Button
          variant="outline"
          size="sm"
          :icon="layout === 'split' ? Columns2 : Rows2"
        >
          {{ layout === 'split' ? t(l.split) : t(l.unified) }}
          <span
            v-if="hideWhitespace"
            :class="css.reviewToolbar_whitespace"
            >· {{ t(l.whitespaceHidden) }}</span
          >
          <ChevronDown
            :class="css.reviewToolbar_open"
            aria-hidden="true"
          />
        </Button>
      </template>
      <div :class="css.reviewToolbar_options">
        <div :class="css.reviewToolbar_section">
          <span :class="css.reviewToolbar_label">{{ t(l.layout) }}</span>
          <SegmentedTabs
            v-model="layout"
            :label="t(l.layout)"
            :options="layoutOptions"
          />
        </div>
        <hr :class="css.reviewToolbar_rule" />
        <label :class="css.reviewToolbar_switch">
          {{ t(l.hideWhitespace) }}
          <Switch
            v-model="hideWhitespace"
            :label="t(l.hideWhitespace)"
          />
        </label>
        <p :class="css.reviewToolbar_note">{{ t(l.keptNote) }}</p>
      </div>
    </Popover>
    <IconButton
      :icon="Github"
      :label="t(l.openOnGitHub)"
      :link="githubUrl"
      target="_blank"
      rel="noopener noreferrer"
    />
  </header>
</template>

<style lang="scss" module="css">
.reviewToolbar {
  display: flex;
  flex: none;
  gap: $spacing-10;
  align-items: center;
  height: $list-header-height;
  padding: 0 $spacing-12 0 $spacing-10;
  border-bottom: 1px solid $color-border;
}

.reviewToolbar_state {
  flex: none;
  width: 14px;
  height: 14px;
}

.reviewToolbar_state_open {
  color: $color-green;
}

.reviewToolbar_state_merged {
  color: $color-purple;
}

.reviewToolbar_state_closed {
  color: $color-red;
}

.reviewToolbar_state_draft {
  color: $color-fg-dim;
}

.reviewToolbar_repository {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.reviewToolbar_number {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.reviewToolbar_title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewToolbar_where {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-dim;
}

.reviewToolbar_spacer {
  flex: 1;
}

.reviewToolbar_whitespace {
  color: $color-fg-dim;
}

.reviewToolbar_open {
  width: 12px;
  height: 12px;
  margin-left: $spacing-2;
  color: $color-fg-3;
  vertical-align: -2px;
}

.reviewToolbar_options {
  display: flex;
  flex-direction: column;
  width: 300px;
  padding: $spacing-6 0;
}

.reviewToolbar_section {
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
  padding: $spacing-8 $spacing-12;
}

.reviewToolbar_label {
  font-size: $font-size-2xs;
  font-weight: $font-weight-medium;
  color: $color-fg-dim;
}

.reviewToolbar_rule {
  width: 100%;
  height: 1px;
  margin: 0;
  background: $color-border;
  border: 0;
}

.reviewToolbar_switch {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-10 $spacing-12;
  font-size: $font-size-sm;
  color: $color-fg;
  cursor: pointer;
}

.reviewToolbar_note {
  padding: $spacing-8 $spacing-12 $spacing-4;
  margin: 0;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  border-top: 1px solid $color-border;
}
</style>
