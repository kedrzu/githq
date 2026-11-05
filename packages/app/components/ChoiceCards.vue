<!-- One choice out of a few, each a card side by side (`RadioCards`): the repository layout in Settings; with `stacked`, rows in one box (the update stream); or with `rows`, cards one above the other (a code review's comments). A card holds what the caller's slot draws of the option, a radio with its label, and a line of detail. Tab reaches the chosen one and the arrow keys move between them, choosing as they go; focus arriving from anywhere else (the window refocused on a stale card) chooses nothing. The choice can't be cleared, only changed. -->
<script lang="ts">
/** One option of `ChoiceCards`. */
export interface ChoiceCardsOption<T extends string> {
  value: T;
  label: string;
  /** The line under the label, which describes the card to a screen reader too. */
  detail: string;
}
</script>

<script lang="ts" setup generic="T extends string">
import { useId } from 'vue';

import RadioCards from './RadioCards.vue';

defineProps<{
  options: readonly ChoiceCardsOption<T>[];
  /** The id of the heading naming the group. */
  labelledby: string;
  /** One above the other in one box, the line of detail under the label, for options with no picture to compare. */
  stacked?: boolean;
  /** One above the other, each a card of its own, the radio beside its label and detail. */
  rows?: boolean;
}>();

defineSlots<{
  /** What the card shows of the option, above its label. */
  default?(props: { option: ChoiceCardsOption<T> }): unknown;
}>();

const model = defineModel<T>({ required: true });

const id = useId();
</script>

<template>
  <RadioCards
    v-model="model"
    :options="options"
    :get-card-attrs="
      ({ value }) => ({
        class: css.choiceCards_card,
        'aria-labelledby': `${id}-${value}`,
        'aria-describedby': `${id}-${value}-detail`,
      })
    "
    :aria-labelledby="labelledby"
    :class="[css.choiceCards, stacked && css.choiceCards_stacked, rows && css.choiceCards_rows]"
  >
    <template #default="{ option }">
      <slot :option="option" />
      <span :class="css.choiceCards_head">
        <span :class="css.choiceCards_radio" />
        <span
          :id="`${id}-${option.value}`"
          :class="css.choiceCards_label"
          >{{ option.label }}</span
        >
      </span>
      <span
        :id="`${id}-${option.value}-detail`"
        :class="css.choiceCards_detail"
        >{{ option.detail }}</span
      >
    </template>
  </RadioCards>
</template>

<style lang="scss" module="css">
.choiceCards {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: $spacing-12;
}

.choiceCards_card {
  @include focus-ring;

  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-12;
  font-family: $font-family-sans;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &:hover {
    border-color: $color-border-2;
  }

  &[data-state='checked'] {
    background: rgba($color-accent, 0.06);
    border-color: $color-accent;
  }
}

.choiceCards_stacked {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid $color-border;
  border-radius: $radius-xl;

  .choiceCards_card {
    gap: 3px;
    padding: $spacing-12 $spacing-14;
    background: none;
    border: none;
    border-radius: $radius-xl;

    + .choiceCards_card {
      border-top: 1px solid $color-border;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
  }

  .choiceCards_head {
    gap: $spacing-10;
  }

  .choiceCards_detail {
    padding-left: 24px;
  }
}

.choiceCards_rows {
  grid-auto-flow: row;

  .choiceCards_card {
    gap: 3px;
    padding: $spacing-12 $spacing-14;
    border-radius: $radius-lg;
  }

  .choiceCards_head {
    gap: $spacing-12;
  }

  .choiceCards_label {
    font-size: $font-size-sm;
  }

  .choiceCards_detail {
    padding-left: 26px;
    font-size: $font-size-xs;
  }
}

.choiceCards_head {
  display: flex;
  gap: $spacing-8;
  align-items: center;
}

.choiceCards_radio {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid $color-fg-3;
  border-radius: 50%;

  [data-state='checked'] > .choiceCards_head > & {
    border-color: $color-accent;

    &::after {
      width: 6px;
      height: 6px;
      content: '';
      background: $color-accent;
      border-radius: 50%;
    }
  }
}

.choiceCards_label {
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
}

.choiceCards_detail {
  font-size: $font-size-sm;
  line-height: $line-height-normal;
  color: $color-fg-2;
}
</style>
