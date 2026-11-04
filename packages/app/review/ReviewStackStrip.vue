<!-- The bar a stack's rows leave pinned at the top of the review's left column once it scrolls (D25, `Review / Stack strip`, CR48), taking no height of its own: the stack's name and one square per pull request, soft in its state, the open one outlined with a mark under it. A square is a link to that pull request's review, replacing the address (D2), so one click per pull request stays; a place the copy doesn't hold yet is a hollow square going nowhere. Too long for the column, the squares scroll sideways, the open one in view. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Layers } from 'lucide-vue-next';
import { computed, onMounted, useTemplateRef } from 'vue';

import { getItemReference, getReviewPath } from '@/item/itemRoutes.js';
import { getPullRequestLook } from '@/lists/utils/getPullRequestLook.js';
import { getStackMemberKind } from '@/lists/utils/getStackMemberKind.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';

import * as l from './ReviewStackStrip.loc.js';

const props = defineProps<{
  stack: StackDescription;
  /** The id of the pull request under review. */
  currentId: string;
}>();

const t = useTranslate();
const places = useTemplateRef<HTMLElement>('places');

const squares = computed(() =>
  props.stack.pips.map((pip, index) => {
    const position = index + 1;
    if (pip.kind === 'missing') {
      return { position, link: null };
    }

    const { pullRequest } = pip;
    return {
      position,
      link: {
        path: getReviewPath(getItemReference(pullRequest)),
        label: t(l.pullRequest, { position, number: pullRequest.number, title: pullRequest.title }),
        tone: getPullRequestLook(getStackMemberKind(pip)).tone,
        current: pullRequest.id === props.currentId,
      },
    };
  }),
);

// By hand: `scrollIntoView` would move the column too. A pull request's review mounts anew, so once is enough.
onMounted(() => {
  const square = places.value?.querySelector<HTMLElement>('[aria-current="true"]');
  if (places.value && square) {
    places.value.scrollLeft = square.offsetLeft - (places.value.clientWidth - square.offsetWidth) / 2;
  }
});
</script>

<template>
  <div :class="css.reviewStackStrip">
    <div :class="css.reviewStackStrip_bar">
      <Layers
        :class="css.reviewStackStrip_icon"
        aria-hidden="true"
      />
      <span :class="css.reviewStackStrip_name">{{ stack.name.title }}</span>
      <ol
        ref="places"
        :class="css.reviewStackStrip_places"
        :aria-label="t(l.places)"
      >
        <li
          v-for="square in squares"
          :key="square.position"
        >
          <RouterLink
            v-if="square.link"
            :to="square.link.path"
            replace
            :class="[
              css.reviewStackStrip_place,
              css[`reviewStackStrip_place_${square.link.tone}`],
              square.link.current && css.reviewStackStrip_place_current,
            ]"
            :aria-label="square.link.label"
            :aria-current="square.link.current ? 'true' : undefined"
            :title="square.link.label"
          >
            {{ square.position }}
          </RouterLink>
          <span
            v-else
            :class="[css.reviewStackStrip_place, css.reviewStackStrip_place_missing]"
          >
            {{ square.position }}
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>

<style lang="scss" module="css">
// No height: it pins at the top of the column and covers what goes by under it, so nothing below it ever moves.
.reviewStackStrip {
  position: sticky;
  top: 0;
  z-index: 2;
  flex: none;
  height: 0;
}

.reviewStackStrip_bar {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  height: $review-stack-strip-height;
  padding: 0 $spacing-10 0 14px;
  background: $color-bg;
  border-bottom: 1px solid $color-border;
}

.reviewStackStrip_icon {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-fg-3;
}

.reviewStackStrip_name {
  flex: 1 1 0;
  min-width: 48px;
  overflow: hidden;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reviewStackStrip_places {
  display: flex;
  flex: 0 1 auto;
  gap: 3px;
  align-items: center;
  align-self: stretch;
  min-width: 0;
  padding: 0;
  margin: 0;
  overflow: auto hidden;
  list-style: none;
  scrollbar-width: none;
}

.reviewStackStrip_place {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-family: $font-family-mono;
  font-size: $font-size-4xs;
  font-weight: $font-weight-medium;
  color: var(--place-color);
  text-decoration: none;
  background: color-mix(in srgb, var(--place-tint, var(--place-color)) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--place-tint, var(--place-color)) 35%, transparent);
  border-radius: $radius-sm;

  @include focus-ring;
}

.reviewStackStrip_place_accent {
  --place-color: #{$color-accent};
}

.reviewStackStrip_place_danger {
  --place-color: #{$color-red};
}

.reviewStackStrip_place_warning {
  --place-color: #{$color-amber};
}

.reviewStackStrip_place_success {
  --place-color: #{$color-green};
}

.reviewStackStrip_place_done {
  --place-color: #{$color-purple};
}

.reviewStackStrip_place_muted,
.reviewStackStrip_place_dim {
  --place-color: #{$color-fg-2};
  --place-tint: #{$color-fg-3};
}

.reviewStackStrip_place_missing {
  --place-color: #{$color-fg-dim};

  background: none;
  border-color: $color-border-2;
}

.reviewStackStrip_place_current {
  font-weight: 700;
  border-color: var(--place-color);

  // In the space under it, taking no room: nothing shifts while walking (stacked PRs D25).
  &::after {
    position: absolute;
    bottom: -5px;
    left: 3px;
    width: 10px;
    height: 2px;
    content: '';
    background: var(--place-color);
    border-radius: 1px;
  }
}
</style>
