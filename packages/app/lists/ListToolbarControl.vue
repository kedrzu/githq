<!-- One of a list's view options (D9) — the grouping, the order, the properties, the layout, a project's row field — drawn where the toolbar puts it: on the toolbar as a compact control with its own icon (a menu, a popover of chips, the layout toggle), or, when the toolbar has no room for it, in the display options under its heading. -->
<script lang="ts">
import type { LucideIcon } from 'lucide-vue-next';

import type { SegmentedTabsOption } from '@/components/SegmentedTabs.vue';

import type { ListChoice } from './ListTypes.js';

/** One of the view options a list's toolbar shows, by how it is chosen. */
export type ListToolbarOption =
  /** One choice out of many, in a menu (the grouping, the order, a project's row field). */
  | {
      readonly kind: 'menu';
      readonly key: string;
      /** Its heading in the display options ("Group"). */
      readonly label: string;
      readonly icon: LucideIcon;
      /** The button's text, the choice in it ("Group: Milestone"). */
      readonly title: string;
      readonly choices: readonly ListChoice[];
      readonly value: string;
      /** Dim text under it in the display options. */
      readonly detail?: string;
      readonly choose: (value: string) => void;
    }
  /** One choice out of a few, side by side (the layout). */
  | {
      readonly kind: 'tabs';
      readonly key: string;
      readonly label: string;
      readonly options: readonly SegmentedTabsOption<string>[];
      readonly value: string;
      readonly choose: (value: string) => void;
    }
  /** Several of a few, each a chip (the properties). */
  | {
      readonly kind: 'chips';
      readonly key: string;
      readonly label: string;
      readonly icon: LucideIcon;
      readonly choices: readonly ListChoice[];
      readonly value: readonly string[];
      readonly choose: (value: readonly string[]) => void;
    };
</script>

<script lang="ts" setup>
import { computed } from 'vue';

import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuRadioGroup from '@/components/MenuRadioGroup.vue';
import MenuRadioItem from '@/components/MenuRadioItem.vue';
import Popover from '@/components/Popover.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import ToggleChips from '@/components/ToggleChips.vue';

const props = defineProps<{
  option: ListToolbarOption;
  /** `toolbar`: on the toolbar itself; `display`: in the display options, under its heading. */
  place: 'display' | 'toolbar';
}>();

/** A menu's choices under their headings, in order. */
const sections = computed(() => {
  const result: { label: string | undefined; choices: ListChoice[] }[] = [];
  if (props.option.kind !== 'menu') {
    return result;
  }

  for (const choice of props.option.choices) {
    const last = result.at(-1);
    if (last && last.label === choice.section) {
      last.choices.push(choice);
    } else {
      result.push({ label: choice.section, choices: [choice] });
    }
  }

  return result;
});
</script>

<template>
  <div :class="place === 'display' ? css.listToolbarControl_option : css.listToolbarControl">
    <span
      v-if="place === 'display'"
      :class="css.listToolbarControl_label"
      >{{ option.label }}</span
    >
    <Menu
      v-if="option.kind === 'menu'"
      :align="place === 'toolbar' ? 'end' : 'start'"
    >
      <template #trigger>
        <Button
          variant="outline"
          size="sm"
          :icon="option.icon"
        >
          {{ option.title }}
        </Button>
      </template>
      <MenuRadioGroup
        :model-value="option.value"
        @update:model-value="option.choose"
      >
        <template
          v-for="section in sections"
          :key="section.label ?? ''"
        >
          <MenuLabel v-if="section.label">{{ section.label }}</MenuLabel>
          <MenuRadioItem
            v-for="choice in section.choices"
            :key="choice.value"
            :value="choice.value"
            :icon="choice.icon"
            :detail="choice.detail"
          >
            {{ choice.label }}
          </MenuRadioItem>
        </template>
      </MenuRadioGroup>
    </Menu>
    <SegmentedTabs
      v-else-if="option.kind === 'tabs'"
      :model-value="option.value"
      variant="boxed"
      :label="option.label"
      :options="option.options"
      @update:model-value="option.choose"
    />
    <template v-else-if="place === 'display'">
      <ToggleChips
        :model-value="option.value"
        :label="option.label"
        :options="option.choices"
        @update:model-value="option.choose"
      />
    </template>
    <Popover
      v-else
      :label="option.label"
      align="end"
    >
      <template #trigger>
        <Button
          variant="outline"
          size="sm"
          :icon="option.icon"
        >
          {{ option.label }}
        </Button>
      </template>
      <div :class="css.listToolbarControl_chips">
        <ToggleChips
          :model-value="option.value"
          :label="option.label"
          :options="option.choices"
          @update:model-value="option.choose"
        />
      </div>
    </Popover>
    <span
      v-if="place === 'display' && option.kind === 'menu' && option.detail"
      :class="css.listToolbarControl_detail"
      >{{ option.detail }}</span
    >
  </div>
</template>

<style lang="scss" module="css">
.listToolbarControl {
  display: flex;
  flex: none;
}

.listToolbarControl_option {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  align-items: flex-start;
}

.listToolbarControl_label {
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.listToolbarControl_detail {
  font-size: $font-size-2xs;
  line-height: $line-height-normal;
  color: $color-fg-dim;
}

.listToolbarControl_chips {
  width: 280px;
  padding: $spacing-4;
}
</style>
