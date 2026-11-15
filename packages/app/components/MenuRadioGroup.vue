<!-- One choice out of several inside a `Menu` (reka-ui's `DropdownMenuRadioGroup`): its items are `MenuRadioItem`s, the chosen one checked; picking one changes the choice and closes the menu. A list's grouping ("Group: Milestone") is chosen in one. In a phone's menu at the bottom (`MenuSheet`) the same, as its rows. -->
<script lang="ts">
import { defineContext } from '@nzyme/vue-utils/context.js';

/** The choice of a `MenuRadioGroup` in a phone's menu at the bottom, for its items. */
export interface MenuRadioContext {
  /** The value chosen; reactive. */
  readonly value: string;
  choose(value: string): void;
}

export const MenuRadioContext = defineContext<MenuRadioContext>('MenuRadioContext');
</script>

<script lang="ts" setup>
import { injectContext, provideContext } from '@nzyme/vue-utils/context.js';
import { DropdownMenuRadioGroup } from 'reka-ui';

import { MenuSheetContext } from './MenuSheetContext.js';

defineSlots<{
  /** The `MenuRadioItem`s, `MenuLabel`s between them. */
  default(): unknown;
}>();

const model = defineModel<string>({ required: true });
const sheet = injectContext(MenuSheetContext, { optional: true });

provideContext(MenuRadioContext, {
  get value() {
    return model.value;
  },
  choose(value) {
    model.value = value;
  },
});
</script>

<template>
  <div
    v-if="sheet"
    role="group"
  >
    <slot />
  </div>
  <DropdownMenuRadioGroup
    v-else
    v-model="model"
  >
    <slot />
  </DropdownMenuRadioGroup>
</template>
