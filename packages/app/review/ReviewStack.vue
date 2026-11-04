<!-- The stack at the top of the review's left column (D25, `Review / Stack`): a head with its name and "2 of 4", then one row per pull request the copy holds, first to last — state icon, number, title — the open one highlighted. A row is a link to that pull request's review, replacing the address (D2), so a middle click opens a tab. Every row, however long the stack: they scroll away with the column and take nothing from the diff. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Layers } from 'lucide-vue-next';
import { computed } from 'vue';

import { getItemReference, getReviewPath } from '@/item/itemRoutes.js';
import { place as placeText } from '@/item/StackMap.loc.js';
import StackTone from '@/lists/StackTone.vue';
import { getPullRequestLook } from '@/lists/utils/getPullRequestLook.js';
import { getStackMemberKind } from '@/lists/utils/getStackMemberKind.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { getStackMembers } from '@/store/stacks/getStackMembers.js';
import { getStackPlace } from '@/store/stacks/getStackPlace.js';

import * as l from './ReviewStack.loc.js';

const props = defineProps<{
  stack: StackDescription;
  /** The id of the pull request under review. */
  currentId: string;
}>();

const t = useTranslate();

const members = computed(() => getStackMembers(props.stack.pips));
const rows = computed(() =>
  members.value.map(pip => ({
    pullRequest: pip.pullRequest,
    look: getPullRequestLook(getStackMemberKind(pip)),
    path: getReviewPath(getItemReference(pip.pullRequest)),
    current: pip.pullRequest.id === props.currentId,
  })),
);
const place = computed(() => getStackPlace(members.value, props.currentId));
</script>

<template>
  <section
    :class="css.reviewStack"
    :aria-label="t(l.label)"
  >
    <div :class="css.reviewStack_head">
      <Layers
        :class="css.reviewStack_icon"
        aria-hidden="true"
      />
      <span :class="css.reviewStack_name">{{ stack.name.title }}</span>
      <span :class="css.reviewStack_place">{{ t(placeText, { position: place, size: stack.size }) }}</span>
    </div>
    <ol
      :class="css.reviewStack_rows"
      :aria-label="t(l.pullRequests)"
    >
      <li
        v-for="row in rows"
        :key="row.pullRequest.id"
      >
        <RouterLink
          :to="row.path"
          replace
          :class="css.reviewStack_row"
          :aria-current="row.current ? 'true' : undefined"
        >
          <StackTone
            :look="row.look"
            :class="css.reviewStack_state"
          />
          <span :class="css.reviewStack_number">#{{ row.pullRequest.number }}</span>
          <span :class="css.reviewStack_title">{{ row.pullRequest.title }}</span>
        </RouterLink>
      </li>
    </ol>
  </section>
</template>

<style lang="scss" module="css">
.reviewStack {
  flex: none;
  padding: $spacing-8 $spacing-6;
  border-bottom: 1px solid $color-border;
}

.reviewStack_head {
  display: flex;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
  padding: $spacing-2 $spacing-8 $spacing-4;
}

.reviewStack_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.reviewStack_name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewStack_place {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-2xs;
  color: $color-fg-dim;
}

.reviewStack_rows {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.reviewStack_row {
  display: flex;
  gap: 7px;
  align-items: center;
  height: 24px;
  padding: 0 $spacing-8;
  font-size: $font-size-xs;
  color: $color-fg-2;
  text-decoration: none;
  border-radius: 5px;

  @include focus-ring;

  &:hover {
    background: $color-bg-3;
  }
}

.reviewStack_row[aria-current='true'],
.reviewStack_row[aria-current='true']:hover {
  color: $color-fg;
  background: $color-sel;
}

.reviewStack_state {
  flex: none;
}

.reviewStack_number {
  flex: none;
  font-family: $font-family-mono;
  font-size: $font-size-3xs;
  color: $color-fg-dim;
}

.reviewStack_title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
