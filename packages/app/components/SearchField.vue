<!-- A one-line field to type a filter or a name into ("Filter 327 repositories…", "Find a repository to track…"): a glyph before it, its key hint after it, and room for a button at its end ("Track"). Named by `label`, which is read out only — the placeholder says the rest. -->
<script lang="ts">
import { useTextInput } from '@nzyme/vue-forms/components/useTextInput.jsx';
import { defineProp } from '@nzyme/vue-utils/defineProp.js';
import type { LucideIcon } from 'lucide-vue-next';

/** nzyme's text input props (`modelValue`, `label` — read out only —, `placeholder`, …), the glyph, the key, the size. */
export const SearchFieldProps = {
  ...useTextInput.props,
  /** The glyph before the text; a magnifier when not given. */
  icon: defineProp<LucideIcon>(),
  /** The key that puts the cursor here ("/"), shown at its end. The caller handles the key. */
  kbd: defineProp<string>(),
  /** `md` (30px) a page's filter, `sm` (26px) a header's; `md` when not given. */
  size: defineProp<'md' | 'sm'>(),
};
</script>

<script lang="ts" setup>
import { Search } from 'lucide-vue-next';

import Kbd from './Kbd.vue';

defineProps(SearchFieldProps);
defineEmits(useTextInput.emits);
defineSlots<{
  /** A button at the field's end ("Track"). */
  end?(): unknown;
}>();

const { TextInput, input } = useTextInput();

defineExpose({
  /** Puts the cursor in the field. */
  focus: () => input.value?.focus(),
});
</script>

<template>
  <div :class="[css.searchField, css[`searchField_${size ?? 'md'}`]]">
    <component
      :is="icon ?? Search"
      :class="css.searchField_icon"
      aria-hidden="true"
    />
    <TextInput
      :class="css.searchField_input"
      :aria-keyshortcuts="kbd ?? undefined"
    />
    <Kbd v-if="kbd">{{ kbd }}</Kbd>
    <slot name="end" />
  </div>
</template>

<style lang="scss" module="css">
.searchField {
  display: flex;
  gap: $spacing-8;
  align-items: center;
  min-width: 0;
  background: $color-bg;
  border: 1px solid $color-border-2;
  border-radius: 7px;

  &:focus-within {
    border-color: $color-focus;
  }
}

.searchField_md {
  padding: 5px 10px;
  font-size: $font-size-md;
}

.searchField_sm {
  padding: 3px 9px;
  font-size: $font-size-sm;
  border-radius: $radius-md;
}

.searchField_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.searchField_input {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
  font-family: inherit;
  font-size: inherit;
  line-height: 16px;
  color: $color-fg;
  background: none;
  border: none;
  outline: none;

  &::placeholder {
    color: $color-fg-dim;
    opacity: 1;
  }
}
</style>
