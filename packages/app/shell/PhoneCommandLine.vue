<!-- The command line floating over a phone screen's bottom (mobile D17), the phone's ⌘K: on a list one wide pill — ⌘ in the accent, a chip naming the part of the place shown with its count when the screen says one and a dot when it is a project view changed on this device (`PhoneLayout.part`, mobile D49), "Do or find…" — opening the command menu (`menu`), which lists the place's parts first; on an item's page "Leave a comment…", which brings the item's comment box into view with the cursor in it (`comment`), and beside it a round ⌘ button opening the command menu. -->
<script lang="ts">
/** `list` on any screen but an item's page; `item` there. */
export type PhoneCommandLineVariant = 'item' | 'list';
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Command } from 'lucide-vue-next';

import { APP_KEYS } from '@/commands/CommandRegistry.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import IconButton from '@/components/IconButton.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import * as l from './PhoneCommandLine.loc.js';
import type { PhonePart } from './PhoneLayout.js';
import PhonePill from './PhonePill.vue';

defineProps<{
  variant: PhoneCommandLineVariant;
  /** On a list, the part of the place it shows, for the chip; none, no chip. */
  part?: PhonePart | null;
}>();

const emit = defineEmits<{
  /** ⌘ or "Do or find…": the command menu. */
  menu: [];
  /** "Leave a comment…": the item's comment box. */
  comment: [];
}>();

const t = useTranslate();
const numbers = new Intl.NumberFormat(APP_LANGUAGE);
const keyshortcuts = formatAriaKeyShortcuts(APP_KEYS.commandMenu);
</script>

<template>
  <div :class="css.phoneCommandLine">
    <PhonePill
      v-if="variant === 'list'"
      :aria-keyshortcuts="keyshortcuts"
      @click="emit('menu')"
    >
      <Command
        :class="css.phoneCommandLine_icon"
        aria-hidden="true"
      />
      <span
        v-if="part"
        :class="css.phoneCommandLine_chip"
      >
        <span :class="css.phoneCommandLine_chipLabel">{{ part.label }}</span>
        <span
          v-if="part.changed"
          :class="css.phoneCommandLine_changed"
          role="img"
          :aria-label="t(l.changed)"
        />
        <span
          v-if="part.count != null"
          :class="css.phoneCommandLine_chipCount"
          >{{ numbers.format(part.count) }}</span
        >
      </span>
      <span :class="css.phoneCommandLine_placeholder">{{ t(l.doOrFind) }}</span>
    </PhonePill>
    <template v-else>
      <PhonePill @click="emit('comment')">
        <span :class="css.phoneCommandLine_placeholder">{{ t(l.leaveComment) }}</span>
      </PhonePill>
      <IconButton
        :class="css.phoneCommandLine_menu"
        :icon="Command"
        :label="t(l.commandMenu)"
        :keyshortcuts="keyshortcuts"
        @click="emit('menu')"
      />
    </template>
  </div>
</template>

<style lang="scss" module="css">
.phoneCommandLine {
  display: flex;
  gap: $spacing-10;
  align-items: center;
}

.phoneCommandLine_icon {
  flex: none;
  width: 20px;
  height: 20px;
  color: $color-accent;
}

.phoneCommandLine_chip {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: baseline;
  max-width: 50%;
  padding: $spacing-4 $spacing-8;
  font-size: $font-size-md;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.phoneCommandLine_chipLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  color: $color-fg;
  white-space: nowrap;
}

.phoneCommandLine_changed {
  flex: none;
  align-self: center;
  width: 6px;
  height: 6px;
  background: $color-accent;
  border-radius: 50%;
}

.phoneCommandLine_chipCount {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.phoneCommandLine_placeholder {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// A round button as tall as the pill beside it, raised the same.
.phoneCommandLine_menu {
  --icon-button-width: #{$phone-command-line-height};
  --icon-button-height: #{$phone-command-line-height};
  --icon-button-glyph-size: #{$phone-icon-size};
  --icon-button-radius: 50%;
  --icon-button-color: #{$color-accent};
  --icon-button-hover-color: #{$color-accent};
  --icon-button-background: #{$color-bg-3};
  --icon-button-hover-background: #{$color-bg-3};
  --icon-button-border: 1px solid #{$color-border-2};

  box-shadow: $shadow-phone-command-line;
}
</style>
