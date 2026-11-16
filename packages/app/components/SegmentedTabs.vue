<!-- One choice out of a few, side by side (reka-ui's single `ToggleGroup`): my work's filter "All / Needs me / Waiting on others", the List / Board layout, the merge panel's methods with their keys shown. Each option is a toggle button (`aria-pressed`); Tab reaches the chosen one and the arrow keys move between them. The choice can't be cleared, only changed; pressing the chosen one again is told (`repeat`: a project's order on a phone flips its direction). `variant="strip"`: pills a finger can tap, in a row that scrolls sideways when they don't fit (a phone's filters of my work, mobile D23). `orientation="vertical"`: one above the other as navigation rows with their keys shown, ↑/↓ moving (Settings' sections, `roomy`). -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';

/** One option of `SegmentedTabs`. */
export interface SegmentedTabsOption<T extends string> {
  value: T;
  /** Shown, or with `iconOnly` the option's accessible name. */
  label: string;
  icon?: LucideIcon;
  /** The icon alone, `label` read out only (List / Board). */
  iconOnly?: boolean;
  disabled?: boolean;
  /** The option's key ("1"), for `aria-keyshortcuts` (and shown with `showKeys`); the caller handles the key. */
  keyshortcuts?: string;
  /** How many it holds, dim after the label ("Repositories 15"); `–` while that is not known yet. */
  count?: number | string;
  /** An amber dot after the label: something there needs the user, read out as this ("Syncing stopped"). */
  attention?: string;
  /** A hint on hover and focus ("Go to issues"), its key after it. */
  tooltip?: string;
}
</script>

<script lang="ts" setup generic="T extends string">
import type { AcceptableValue } from 'reka-ui';
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui';

import Kbd from './Kbd.vue';
import Tooltip from './Tooltip.vue';

const props = withDefaults(
  defineProps<{
    options: readonly SegmentedTabsOption<T>[];
    /** The group's accessible name ("Filters"). */
    label: string;
    /**
     * `plain`: text tabs, the chosen one raised (filters); `boxed`: icons in an outlined box (layout); `strip`: outlined
     * pills, the chosen one in the accent, scrolling sideways when they don't fit (a phone's filters).
     */
    variant?: 'boxed' | 'plain' | 'strip';
    /** The options wrap onto more lines when they don't fit (a long choice inline in the display options). */
    wrap?: boolean;
    /** Each option's key shown dim after its label (the merge panel's methods, "Squash 1"). */
    showKeys?: boolean;
    /** `vertical`: rows, each with its icon, label, count and key, moved through by ↑/↓. Unset: side by side. */
    orientation?: 'vertical';
    /** With `orientation="vertical"`: taller rows, comfortable to click (Settings' sections). */
    roomy?: boolean;
  }>(),
  { variant: 'plain', wrap: false, showKeys: false },
);

const emit = defineEmits<{
  /** The chosen option was pressed again; the choice stays. */
  repeat: [value: T];
}>();

const model = defineModel<T>({ required: true });

// reka-ui clears a single toggle group when its chosen item is pressed again: the choice stays, and that is told.
function choose(value: AcceptableValue | AcceptableValue[] | undefined) {
  const option = props.options.find(candidate => candidate.value === value);
  if (option) {
    model.value = option.value;
  } else if (value == null) {
    emit('repeat', model.value);
  }
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="model"
    :aria-label="label"
    :orientation="orientation"
    :class="[
      css.segmentedTabs,
      css[`segmentedTabs_${variant}`],
      wrap && css.segmentedTabs_wrap,
      orientation === 'vertical' && css.segmentedTabs_vertical,
      roomy && css.segmentedTabs_roomy,
    ]"
    @update:model-value="choose"
  >
    <Tooltip
      v-for="option in options"
      :key="option.value"
      :text="option.tooltip"
      :kbd="option.keyshortcuts"
      :disabled="!option.tooltip"
    >
      <ToggleGroupItem
        :value="option.value"
        :disabled="option.disabled"
        :aria-label="option.iconOnly ? option.label : undefined"
        :aria-keyshortcuts="option.keyshortcuts"
        :class="[css.segmentedTabs_item, option.iconOnly && css.segmentedTabs_item_icon]"
      >
        <component
          :is="option.icon"
          v-if="option.icon"
          :class="css.segmentedTabs_icon"
          aria-hidden="true"
        />
        <span
          v-if="!option.iconOnly"
          :class="css.segmentedTabs_label"
          >{{ option.label }}</span
        >
        <span
          v-if="option.count != null"
          :class="css.segmentedTabs_count"
          >{{ option.count }}</span
        >
        <span
          v-if="showKeys && option.keyshortcuts"
          :class="css.segmentedTabs_count"
          aria-hidden="true"
          >{{ option.keyshortcuts }}</span
        >
        <span
          v-if="option.attention"
          :class="css.segmentedTabs_attention"
          role="img"
          :aria-label="option.attention"
        />
        <Kbd
          v-if="orientation === 'vertical' && option.keyshortcuts"
          :keys="option.keyshortcuts"
          size="sm"
        />
      </ToggleGroupItem>
    </Tooltip>
  </ToggleGroupRoot>
</template>

<style lang="scss" module="css">
.segmentedTabs {
  display: flex;
  flex: none;
  align-items: center;
}

.segmentedTabs_wrap {
  flex: 0 1 auto;
  flex-wrap: wrap;
  max-width: 100%;
}

.segmentedTabs_plain {
  gap: $spacing-4;
}

// Scrolls rather than squeezing or wrapping its pills; the padding keeps their focus ring inside what it clips.
.segmentedTabs_strip {
  gap: $spacing-8;
  max-width: 100%;
  padding: $spacing-4;
  overflow-x: auto;
  scrollbar-width: none;
}

.segmentedTabs_boxed {
  @include segmented-box;
}

.segmentedTabs_vertical {
  flex-direction: column;
  gap: 1px;
  align-items: stretch;
}

.segmentedTabs_roomy {
  gap: $spacing-2;
}

// The chosen one by `aria-pressed`, not `data-state`: a tooltip's trigger sets a `data-state` of its own.
.segmentedTabs_item {
  @include segmented-box-item;

  border: 1px solid transparent;
  border-radius: $radius-md;

  &[aria-pressed='true'] {
    @include segmented-box-item-current;

    border-color: $color-border-2;
  }

  &:disabled {
    color: $color-fg-3;
    cursor: default;
  }

  .segmentedTabs_boxed & {
    border: none;
    border-radius: $radius-sm;
  }

  .segmentedTabs_strip & {
    flex: none;
    gap: $spacing-6;
    height: $phone-pill-height;
    padding: 0 $spacing-12;
    font-size: $font-size-lg;
    border-color: $color-border-2;
    border-radius: calc(#{$phone-pill-height} / 2);

    &[aria-pressed='true'] {
      background: $color-sel;
      border-color: $color-accent;
    }
  }

  .segmentedTabs_vertical & {
    @include nav-row;

    font-family: inherit;
    text-align: left;
    border: none;

    &[aria-pressed='true'] {
      @include nav-row-current;
    }
  }

  .segmentedTabs_roomy & {
    gap: $spacing-10;
    padding: $spacing-10 $spacing-8 $spacing-10 $spacing-10;
    border-radius: 7px;
  }
}

.segmentedTabs_item_icon {
  padding: 3px 6px;
}

.segmentedTabs_icon {
  width: 14px;
  height: 14px;

  .segmentedTabs_vertical & {
    flex: none;
    width: 15px;
    height: 15px;
  }
}

.segmentedTabs_label {
  .segmentedTabs_vertical & {
    @include nav-row-label;
  }
}

.segmentedTabs_count {
  @include segmented-count;

  .segmentedTabs_strip & {
    font-size: $font-size-xs;
  }

  .segmentedTabs_vertical & {
    @include nav-row-count;
  }
}

.segmentedTabs_attention {
  flex: none;
  width: 6px;
  height: 6px;
  background: $color-amber;
  border-radius: 50%;
}
</style>
