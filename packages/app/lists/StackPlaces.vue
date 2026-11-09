<!-- A stack's places as a row of numbered squares (stacked PRs D25, `Stack bar / Place`), shared by the review's stack strip and the panel's stack bar: one per pull request, soft in its state, the open one outlined with a mark under it, one with the viewer's draft review with an amber dot on its corner. Given a path for a pull request, a square is a link replacing the address (D2); without one, a button asking to open it. A place the copy doesn't hold yet is a hollow square going nowhere. Too long for the room, the squares scroll sideways, the open one brought into view, again whenever another one is opened. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { computed, onMounted, useTemplateRef, watch } from 'vue';

import { getPullRequestLook } from '@/lists/utils/getPullRequestLook.js';
import { getStackMemberKind } from '@/lists/utils/getStackMemberKind.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import type { StackPip } from '@/store/stacks/describeStack.js';

import * as l from './StackPlaces.loc.js';

const props = defineProps<{
  /** The stack's places, first to last. */
  pips: readonly StackPip[];
  /** The id of the pull request open now, outlined and marked. */
  currentId: string | null;
  /** Where a square leads: given, the squares are links replacing the address; without it, buttons emitting `open`. */
  getPath?: (pullRequest: PullRequestItem) => string;
}>();

const emit = defineEmits<{
  /** A square clicked, when the squares are buttons: open that pull request. */
  open: [id: string];
}>();

const t = useTranslate();
const places = useTemplateRef<HTMLElement>('places');

const squares = computed(() =>
  props.pips.map((pip, index) => {
    const position = index + 1;
    if (pip.kind === 'missing') {
      return { position, place: null };
    }

    const { pullRequest } = pip;
    return {
      position,
      place: {
        id: pullRequest.id,
        path: props.getPath?.(pullRequest) ?? null,
        label: t(pullRequest.pendingReview ? l.pullRequestWithDraft : l.pullRequest, {
          position,
          number: pullRequest.number,
          title: pullRequest.title,
        }),
        draft: pullRequest.pendingReview !== null,
        tone: getPullRequestLook(getStackMemberKind(pip)).tone,
        current: pullRequest.id === props.currentId,
      },
    };
  }),
);

// By hand: `scrollIntoView` would move the column around it too.
function showCurrent() {
  const square = places.value?.querySelector<HTMLElement>('[aria-current="true"]');
  if (places.value && square) {
    const left = square.offsetLeft - places.value.offsetLeft;
    places.value.scrollLeft = left - (places.value.clientWidth - square.offsetWidth) / 2;
  }
}

onMounted(showCurrent);
// A panel's bar stays mounted while `J` and `K` walk the stack.
watch(() => props.currentId, showCurrent, { flush: 'post' });
</script>

<template>
  <ol
    ref="places"
    :class="css.stackPlaces"
    :aria-label="t(l.places)"
  >
    <li
      v-for="square in squares"
      :key="square.position"
    >
      <template v-if="square.place">
        <RouterLink
          v-if="square.place.path !== null"
          :to="square.place.path"
          replace
          :class="[css.stackPlaces_place, css[`stackPlaces_place_${square.place.tone}`]]"
          :aria-label="square.place.label"
          :aria-current="square.place.current ? 'true' : undefined"
          :title="square.place.label"
        >
          {{ square.position }}
          <span
            v-if="square.place.draft"
            :class="css.stackPlaces_draft"
          />
        </RouterLink>
        <button
          v-else
          type="button"
          :class="[css.stackPlaces_place, css[`stackPlaces_place_${square.place.tone}`]]"
          :aria-label="square.place.label"
          :aria-current="square.place.current ? 'true' : undefined"
          :title="square.place.label"
          @click="emit('open', square.place.id)"
        >
          {{ square.position }}
          <span
            v-if="square.place.draft"
            :class="css.stackPlaces_draft"
          />
        </button>
      </template>
      <span
        v-else
        :class="[css.stackPlaces_place, css.stackPlaces_place_missing]"
      >
        {{ square.position }}
      </span>
    </li>
  </ol>
</template>

<style lang="scss" module="css">
.stackPlaces {
  display: flex;
  flex: 0 1 auto;
  // 18 px squares, 24 px apart: the spacing WCAG 2.5.8 asks of a target under 24 px.
  gap: $spacing-6;
  align-items: center;
  align-self: stretch;
  min-width: 0;
  // The last square's draft dot reaches this far past it, which would make the row scroll.
  padding: 0 3px 0 0;
  margin: 0;
  overflow: auto hidden;
  list-style: none;
  scrollbar-width: none;
}

.stackPlaces_place {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  font-family: $font-family-mono;
  font-size: $font-size-4xs;
  font-weight: $font-weight-medium;
  color: var(--place-color);
  text-decoration: none;
  cursor: pointer;
  background: color-mix(in srgb, var(--place-tint, var(--place-color)) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--place-tint, var(--place-color)) 35%, transparent);
  border-radius: $radius-sm;

  @include focus-ring;
}

// `Stack bar / Place · soft, draft`: on the square's corner, ringed apart from it.
.stackPlaces_draft {
  position: absolute;
  top: -3px;
  left: 13px;
  width: 8px;
  height: 8px;
  background: $color-amber;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px $color-bg;
}

.stackPlaces_place_accent {
  --place-color: #{$color-accent};
}

.stackPlaces_place_danger {
  --place-color: #{$color-red};
}

.stackPlaces_place_warning {
  --place-color: #{$color-amber};
}

.stackPlaces_place_success {
  --place-color: #{$color-green};
}

.stackPlaces_place_done {
  --place-color: #{$color-purple};
}

.stackPlaces_place_muted,
.stackPlaces_place_dim {
  --place-color: #{$color-fg-2};
  --place-tint: #{$color-fg-3};
}

.stackPlaces_place_missing {
  --place-color: #{$color-fg-dim};

  cursor: default;
  background: none;
  border-color: $color-border-2;
}

.stackPlaces_place[aria-current='true'] {
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
