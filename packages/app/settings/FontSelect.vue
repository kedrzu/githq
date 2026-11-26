<!-- A role's font (`Settings / Font select`): its label above a bordered trigger showing the font's name and a chevron, which opens a `Menu` headed by `menuLabel` ("Code font") with a `MenuRadioItem` per font, each name set in its own font, the current one checked (`Settings / Font option`, `Settings / Font menu · code`). The system font is named "System", with the fonts it stands for dim after it (`systemHint`). -->
<script lang="ts" setup generic="Id extends string">
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ChevronDown } from 'lucide-vue-next';
import { computed, useId } from 'vue';

import Button from '@/components/Button.vue';
import Menu from '@/components/Menu.vue';
import MenuLabel from '@/components/MenuLabel.vue';
import MenuRadioGroup from '@/components/MenuRadioGroup.vue';
import MenuRadioItem from '@/components/MenuRadioItem.vue';
import type { TypographyFont, TypographyFonts } from '@/typography/typographyCatalog.js';

import * as l from './FontSelect.loc.js';

const props = defineProps<{
  /** Shown above the trigger ("Font"). */
  label: string;
  /** The menu's heading and, on its own, its name ("Code font"). */
  menuLabel: string;
  fonts: TypographyFonts<Id>;
  /** Dim after "System": the fonts it is on the common systems ("SF Mono, Cascadia, Menlo"). */
  systemHint: string;
}>();

const font = defineModel<Id>({ required: true });

const t = useTranslate();
const id = useId();

const current = computed(() => props.fonts.find(candidate => candidate.id === font.value) ?? props.fonts[0]);

function choose(value: string) {
  const chosen = props.fonts.find(candidate => candidate.id === value);
  if (chosen) {
    font.value = chosen.id;
  }
}

function fontName(option: TypographyFont) {
  return option.label ?? t(l.system);
}
</script>

<template>
  <div :class="css.fontSelect">
    <span
      :id="`${id}-label`"
      :class="css.fontSelect_label"
      >{{ label }}</span
    >
    <Menu :label="menuLabel">
      <template #trigger>
        <Button
          variant="outline"
          block
          :aria-labelledby="`${id}-label ${id}-value`"
        >
          <span
            :id="`${id}-value`"
            :class="css.fontSelect_value"
            >{{ fontName(current) }}</span
          >
          <ChevronDown
            :class="css.fontSelect_chevron"
            aria-hidden="true"
          />
        </Button>
      </template>
      <MenuLabel>{{ menuLabel }}</MenuLabel>
      <MenuRadioGroup
        :model-value="current.id"
        @update:model-value="choose"
      >
        <MenuRadioItem
          v-for="option in fonts"
          :key="option.id"
          :value="option.id"
          :detail="option.label === null ? systemHint : undefined"
        >
          <span :style="{ fontFamily: option.stack }">{{ fontName(option) }}</span>
        </MenuRadioItem>
      </MenuRadioGroup>
    </Menu>
  </div>
</template>

<style lang="scss" module="css">
.fontSelect {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
  width: 200px;
}

.fontSelect_label {
  font-size: $font-size-sm;
  color: $color-fg-2;
}

.fontSelect_value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fontSelect_chevron {
  flex: none;
  margin-left: auto;
  color: $color-fg-dim;
}
</style>
