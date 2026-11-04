<!-- The review's toolbar (D24): back, the pull request's state, repository, number and title, and at the right the way through the list it was opened from, shown once it is known (`K`/`J`, "2 / 4", D16), the view options, under a button naming what's on (split or unified, whitespace hidden, for every pull request: D4, D14), comments in collapsed files and the two columns among them (D13, D26), the columns' toggles beside them (D31), and github.com. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import {
  ArrowLeft,
  ChevronDown,
  Columns2,
  Github,
  GitPullRequest,
  PanelLeft,
  PanelRight,
  Rows2,
} from 'lucide-vue-next';
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import IconButton from '@/components/IconButton.vue';
import Kbd from '@/components/Kbd.vue';
import Popover from '@/components/Popover.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';
import Switch from '@/components/Switch.vue';
import type { ItemReference } from '@/item/itemRoutes.js';
import type { ItemWalkPosition } from '@/item/useItemWalk.js';
import type { Item } from '@/store/ItemTypes.js';
import { getPullRequestKind } from '@/lists/utils/getPullRequestKind.js';

import type { DiffLayout } from './diff/buildDiffRows.js';
import ReviewToggle from './ReviewToggle.vue';
import * as l from './ReviewToolbar.loc.js';

const props = defineProps<{
  reference: ItemReference;
  /** The pull request's row, once known. */
  item: Item | null;
  githubUrl: string;
  /** Where it is in the list it was opened from; `null` outside one, with no way through to show. */
  position: ItemWalkPosition | null;
}>();

const emit = defineEmits<{
  back: [];
  previous: [];
  next: [];
}>();

const layout = defineModel<DiffLayout>('layout', { required: true });
const hideWhitespace = defineModel<boolean>('hideWhitespace', { required: true });
const fileListHidden = defineModel<boolean>('fileListHidden', { required: true });
const conversationShown = defineModel<boolean>('conversationShown', { required: true });
const threadsInCollapsed = defineModel<boolean>('threadsInCollapsed', { required: true });

const t = useTranslate();

const state = computed(() => {
  const { item } = props;
  // Before its row is known it looks open, and says only what it is.
  if (item?.kind !== 'pullRequest') {
    return { icon: GitPullRequest, tone: 'open', label: t(l.pullRequest) };
  }

  const { icon, tone } = getPullRequestKind(item);
  return { icon, tone, label: t(l[`${tone}PullRequest`]) };
});
const fileListShown = computed({
  get: () => !fileListHidden.value,
  set: shown => {
    fileListHidden.value = !shown;
  },
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
      role="img"
      :aria-label="state.label"
    />
    <span :class="css.reviewToolbar_repository">{{ reference.owner }}/{{ reference.name }}</span>
    <span :class="css.reviewToolbar_number">#{{ reference.number }}</span>
    <h1 :class="css.reviewToolbar_title">{{ item?.title }}</h1>
    <span :class="css.reviewToolbar_where">{{ t(l.review) }}</span>
    <span :class="css.reviewToolbar_spacer" />
    <template v-if="position">
      <div :class="css.reviewToolbar_stepper">
        <IconButton
          :label="t(l.previousPullRequest)"
          kbd="K"
          aria-keyshortcuts="K"
          :disabled="position.index <= 1"
          @click="emit('previous')"
        >
          <Kbd keys="K" />
        </IconButton>
        <IconButton
          :label="t(l.nextPullRequest)"
          kbd="J"
          aria-keyshortcuts="J"
          :disabled="position.index >= position.count"
          @click="emit('next')"
        >
          <Kbd keys="J" />
        </IconButton>
        <span :class="css.reviewToolbar_position">{{
          t(l.position, { index: position.index, count: position.count })
        }}</span>
      </div>
      <span
        :class="css.reviewToolbar_divider"
        aria-hidden="true"
      />
    </template>
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
        <label :class="css.reviewToolbar_switch">
          {{ t(l.commentsInCollapsed) }}
          <Switch
            v-model="threadsInCollapsed"
            :label="t(l.commentsInCollapsed)"
          />
        </label>
        <label :class="css.reviewToolbar_switch">
          {{ t(l.fileList) }}
          <span :class="css.reviewToolbar_switchEnd">
            <Kbd keys="Mod+B" />
            <Switch
              v-model="fileListShown"
              :label="t(l.fileList)"
            />
          </span>
        </label>
        <label :class="css.reviewToolbar_switch">
          {{ t(l.conversation) }}
          <span :class="css.reviewToolbar_switchEnd">
            <Kbd keys="Alt+Mod+B" />
            <Switch
              v-model="conversationShown"
              :label="t(l.conversation)"
            />
          </span>
        </label>
        <p :class="css.reviewToolbar_note">{{ t(l.keptNote) }}</p>
      </div>
    </Popover>
    <div :class="css.reviewToolbar_panels">
      <ReviewToggle
        :icon="PanelLeft"
        :label="t(l.fileList)"
        :pressed="fileListShown"
        kbd="Mod+B"
        panel
        @click="fileListShown = !fileListShown"
      />
      <ReviewToggle
        :icon="PanelRight"
        :label="t(l.conversation)"
        :pressed="conversationShown"
        kbd="Alt+Mod+B"
        panel
        @click="conversationShown = !conversationShown"
      />
    </div>
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

.reviewToolbar_state_done {
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

.reviewToolbar_stepper {
  display: flex;
  flex: none;
  gap: $spacing-4;
  align-items: center;
}

.reviewToolbar_position {
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  white-space: nowrap;
}

.reviewToolbar_divider {
  flex: none;
  width: 1px;
  height: 16px;
  background: $color-border-2;
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

.reviewToolbar_switchEnd {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

.reviewToolbar_panels {
  display: flex;
  flex: none;
  gap: $spacing-2;
  padding: $spacing-2;
  border: 1px solid $color-border;
  border-radius: 6px;
}

.reviewToolbar_note {
  padding: $spacing-8 $spacing-12 $spacing-4;
  margin: 0;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
  border-top: 1px solid $color-border;
}
</style>
