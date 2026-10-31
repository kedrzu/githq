<!-- A keyboard hint chip for a key in the app's notation (`Mod+K`, `Enter`, `A`), as this platform writes it (`formatCommandKey`: "⌘K" on a Mac, "Ctrl+K" elsewhere). Key glyphs (⌘ ⇧ ⌥ ⌃ ↵ ⌫ ⇥ and arrows) are drawn as Lucide icons, since the mono font draws them poorly; letters and words ("Esc", "O") stay text. Hidden from screen readers: the control it sits on names its shortcut in `aria-keyshortcuts` instead. -->
<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';
import {
  ArrowBigUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  ChevronUp,
  Command,
  CornerDownLeft,
  Delete,
  Option,
} from 'lucide-vue-next';
import { computed } from 'vue';

import { formatCommandKey } from '@/commands/formatCommandKey.js';

const props = withDefaults(
  defineProps<{
    /** The key in the app's notation (`Mod+Enter`, `Shift+O`, `Escape`); keys apart by spaces share the chip. */
    keys: string;
    /** `onFill`: on a filled button (primary, light) — dark text on a translucent chip. */
    tone?: 'default' | 'onFill';
    /** `sm`: inside a row's meta line ("Open on GitHub O"). */
    size?: 'sm' | 'md';
  }>(),
  { tone: 'default', size: 'md' },
);

const KEY_ICONS: Record<string, LucideIcon> = {
  '⌘': Command,
  '⇧': ArrowBigUp,
  '⌥': Option,
  '⌃': ChevronUp,
  '↵': CornerDownLeft,
  '⌫': Delete,
  '⇥': ArrowRightToLine,
  '↑': ArrowUp,
  '↓': ArrowDown,
  '←': ArrowLeft,
  '→': ArrowRight,
};

/** Each glyph as its icon, each run of other characters as one text. */
const parts = computed(() => {
  const result: ({ icon: LucideIcon } | { text: string })[] = [];
  let text = '';
  for (const char of formatCommandKey(props.keys)) {
    const icon = KEY_ICONS[char];
    if (!icon) {
      text += char;
      continue;
    }
    if (text) {
      result.push({ text });
      text = '';
    }
    result.push({ icon });
  }
  if (text) {
    result.push({ text });
  }
  return result;
});
</script>

<template>
  <kbd
    :class="[css.kbd, css[`kbd_${tone}`], css[`kbd_${size}`]]"
    aria-hidden="true"
  >
    <template
      v-for="(part, index) in parts"
      :key="index"
    >
      <component
        :is="part.icon"
        v-if="'icon' in part"
        :class="css.kbd_icon"
        :stroke-width="2.25"
      />
      <span v-else>{{ part.text }}</span>
    </template>
  </kbd>
</template>

<style lang="scss" module="css">
// Inline, not flex: the icons sit in the text's line box, so the chip keeps the text's height and
// baseline even when it holds only icons ("↵").
.kbd {
  display: inline-block;
  flex: none;
  font-family: $font-family-mono;
  font-weight: $font-weight-normal;
  line-height: 1.4;
  white-space: nowrap;
  border: 1px solid;
  border-radius: $radius-sm;

  > * + * {
    margin-left: 1px;
  }
}

// Centered on the capitals' height, not the x-height `vertical-align: middle` would use.
.kbd_icon {
  width: 1.1em;
  height: 1.1em;
  vertical-align: -0.2em;
}

.kbd_md {
  padding: 1px 5px;
  font-size: 10.5px;
}

.kbd_sm {
  padding: 0 4px;
  font-size: 10px;
}

.kbd_default {
  color: $color-fg-2;
  background: $color-bg-3;
  border-color: $color-border-2;
}

.kbd_onFill {
  color: $color-on-light;
  background: rgba($color-on-light, 0.1);
  border-color: rgba($color-on-light, 0.2);
}
</style>
