<!-- The bar of a stack pinned above an opened pull request's content in a panel (stacked PRs D25, D27, `Stack bar`, SP82–SP84): the stack's name and its places (`StackPlaces`), each square opening that pull request in this one's place. It never moves, folds or changes height. Once the map's rows at the top of the content scroll out of view, a chevron shows right after the name and a click anywhere on the bar outside the squares drops the rows over the content (`dropped`), a second click taking them away again; with the rows in view there is nothing to drop. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown, ChevronUp, Layers } from 'lucide-vue-next';

import StackPlaces from '@/lists/StackPlaces.vue';
import type { StackDescription } from '@/store/stacks/describeStack.js';

import * as l from './StackBar.loc.js';

defineProps<{
  stack: StackDescription;
  /** The id of the pull request opened. */
  currentId: string;
  /** The map's rows at the top of the content are in view: no chevron, nothing to drop. */
  rowsInView: boolean;
}>();

const emit = defineEmits<{
  /** A square picked: its pull request opens in this one's place. */
  open: [id: string];
}>();

/** The rows dropped over the content (D27). */
const dropped = defineModel<boolean>('dropped', { default: false });

const t = useTranslate();
</script>

<template>
  <div :class="css.stackBar">
    <!-- The squares are the toggle's sibling, not inside it: no button in a button. -->
    <button
      type="button"
      :class="css.stackBar_toggle"
      :disabled="rowsInView"
      :aria-expanded="dropped"
      :aria-label="t(l.toggle, { name: stack.name.title })"
      @click="dropped = !dropped"
    >
      <Layers
        :class="css.stackBar_icon"
        aria-hidden="true"
      />
      <span :class="css.stackBar_name">{{ stack.name.title }}</span>
      <!-- Not rendered while the rows are in view; nothing follows it but the spacer, so nothing shifts as it shows. -->
      <span
        v-if="!rowsInView"
        :class="css.stackBar_chevron"
      >
        <component
          :is="dropped ? ChevronUp : ChevronDown"
          :class="css.stackBar_chevronIcon"
          aria-hidden="true"
        />
      </span>
      <span :class="css.stackBar_spacer" />
    </button>
    <StackPlaces
      :pips="stack.pips"
      :current-id="currentId"
      @open="emit('open', $event)"
    />
  </div>
</template>

<style lang="scss" module="css">
.stackBar {
  display: flex;
  flex: none;
  gap: $spacing-8;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-16 0 0;
  background: $color-bg-2;
  border-bottom: 1px solid $color-border;
}

// The bar's own padding on the left is the button's, so the whole bar but the squares toggles.
.stackBar_toggle {
  @include focus-ring;

  display: flex;
  flex: 1;
  gap: $spacing-8;
  align-items: center;
  align-self: stretch;
  min-width: 0;
  padding: 0 0 0 $spacing-16;
  font: inherit;
  color: $color-fg;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;

  &:disabled {
    cursor: default;
  }
}

.stackBar_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.stackBar_name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stackBar_chevron {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.stackBar_chevronIcon {
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.stackBar_spacer {
  flex: 1;
}
</style>
