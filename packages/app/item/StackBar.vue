<!-- The bar of a stack pinned above an opened pull request's content in a panel (stacked PRs D25, D27, `Stack bar`, SP82–SP84): the stack's name and its places (`StackPlaces`), each square opening that pull request in this one's place. It never moves, folds or changes height. Once the map's rows at the top of the content scroll out of view, a chevron shows right after the name and a click anywhere on the bar outside the squares drops the rows over the content (`dropped`), a second click taking them away again; with the rows in view there is nothing to drop. On a phone (`PhoneLayout.active`, mobile D29, MB122) it is the strip under the top bar, the same bar shrunk: the stack's icon, "Stack · 2 of 4", the pips coloured by state (`StackPips`), and ← and → at the right to the previous pull request (towards the base) and the next, each opening in this one's place, disabled at the stack's ends; a tap anywhere else on the strip drops the rows, all of the stack's pull requests with what stops it (D48). -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Layers } from 'lucide-vue-next';
import { computed } from 'vue';

import IconButton from '@/components/IconButton.vue';
import StackPips from '@/lists/StackPips.vue';
import StackPlaces from '@/lists/StackPlaces.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';

import * as l from './StackBar.loc.js';

const props = defineProps<{
  stack: StackDescription;
  /** The id of the pull request opened. */
  currentId: string;
  /** The map's rows at the top of the content are in view: no chevron, nothing to drop. */
  rowsInView: boolean;
}>();

const emit = defineEmits<{
  /** A square picked, or on a phone ← or →: its pull request opens in this one's place. */
  open: [id: string];
}>();

/** The rows dropped over the content (D27). */
const dropped = defineModel<boolean>('dropped', { default: false });

const t = useTranslate();
const phone = useService(PhoneLayout);

/** Where the opened pull request stands in the stack, 1-based; 0 while the copy doesn't hold it. */
const position = computed(
  () => props.stack.pips.findIndex(pip => pip.kind !== 'missing' && pip.pullRequest.id === props.currentId) + 1,
);
/** "Stack · 2 of 4". */
const place = computed(() => t(l.place, { position: position.value, size: props.stack.size }));
/** The nearest pull request the copy holds towards the base, for ←; `null` at the base. */
const previousId = computed(() => findHeld(position.value - 2, -1));
/** The nearest one the copy holds away from the base, for →; `null` at the top. */
const nextId = computed(() => findHeld(position.value, 1));

function toggle() {
  if (!props.rowsInView) {
    dropped.value = !dropped.value;
  }
}

function step(id: string | null) {
  if (id !== null) {
    emit('open', id);
  }
}

/** The id of the first pull request from `index` on in `direction`, stepping over places the copy lacks. */
function findHeld(index: number, direction: 1 | -1) {
  if (position.value === 0) {
    return null;
  }

  for (let i = index; i >= 0 && i < props.stack.pips.length; i += direction) {
    const pip = props.stack.pips[i];
    if (pip && pip.kind !== 'missing') {
      return pip.pullRequest.id;
    }
  }

  return null;
}
</script>

<template>
  <div
    v-if="phone.active"
    :class="[css.stackBar, css.stackBar_phone]"
  >
    <!-- Named by what it shows first, so its visible words lead its name. -->
    <button
      type="button"
      :class="css.stackBar_toggle"
      :aria-expanded="dropped"
      :aria-label="`${place}, ${t(l.toggle, { name: stack.name.title })}`"
      @click="dropped = !dropped"
    >
      <Layers
        :class="css.stackBar_icon"
        aria-hidden="true"
      />
      <span :class="css.stackBar_place">{{ place }}</span>
      <StackPips
        :pips="stack.pips"
        :current="currentId"
      />
    </button>
    <IconButton
      :icon="ArrowLeft"
      :label="t(l.previous)"
      :disabled="previousId === null"
      @click="step(previousId)"
    />
    <IconButton
      :icon="ArrowRight"
      :label="t(l.next)"
      :disabled="nextId === null"
      @click="step(nextId)"
    />
  </div>
  <div
    v-else
    :class="css.stackBar"
  >
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
      <!-- Not rendered while the rows are in view; nothing follows it but the squares, which sit at the bar's gap either way. -->
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
    </button>
    <StackPlaces
      :pips="stack.pips"
      :current-id="currentId"
      @open="emit('open', $event)"
    />
    <!-- The rest of the bar toggles too, as the toggle itself; the keyboard has the button. -->
    <span
      :class="[css.stackBar_rest, rowsInView && css.stackBar_rest_inView]"
      aria-hidden="true"
      @click="toggle"
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

// A phone's strip (MB122): the toggle takes all but the arrows, each a finger's size.
.stackBar_phone {
  @include touch-icon-buttons($phone-row-icon-size);

  gap: 0;
  height: $touch-target-size;
  padding: 0 $spacing-6 0 0;

  // Its icon in line with the item's content under it.
  .stackBar_toggle {
    flex: 1;
    padding-left: $phone-edge-inset;
  }
}

// The bar's own padding on the left is the button's, so the whole bar but the squares toggles.
.stackBar_toggle {
  @include focus-ring;

  display: flex;
  flex: 0 1 auto;
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

.stackBar_place {
  flex: none;
  font-size: $font-size-sm;
  color: $color-fg-2;
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

.stackBar_rest {
  flex: 1;
  align-self: stretch;
  cursor: pointer;
}

.stackBar_rest_inView {
  cursor: default;
}
</style>
