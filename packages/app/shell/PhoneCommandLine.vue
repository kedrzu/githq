<!-- The command line floating over a phone screen's bottom (mobile D17), the phone's ⌘K: on a list one wide pill — ⌘ in the accent, the chip naming the part of the place shown (`PhonePartChip`, from `PhoneLayout.part`) — while the list is selecting several, how many ("3 selected", `selected`, mobile D28) —, "Do or find…" — opening the command menu (`menu`), which lists the place's parts first, or acts on the selection; on an item's page "Leave a comment…" — or what is typed and not posted, the item's draft (`draft`, mobile D18, MB73) — which grows into the item's composer docked above the keyboard (`comment`, D51), and beside it a round ⌘ button opening the command menu. -->
<script lang="ts">
/** `list` on any screen but an item's page; `item` there. */
export type PhoneCommandLineVariant = 'item' | 'list';
</script>

<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Command } from 'lucide-vue-next';
import { computed } from 'vue';

import { APP_KEYS } from '@/commands/CommandRegistry.js';
import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import IconButton from '@/components/IconButton.vue';

import * as l from './PhoneCommandLine.loc.js';
import type { PhonePart } from './PhoneLayout.js';
import PhonePartChip from './PhonePartChip.vue';
import PhonePill from './PhonePill.vue';

const props = defineProps<{
  variant: PhoneCommandLineVariant;
  /** On a list, the part of the place it shows, for the chip; none, no chip. */
  part?: PhonePart | null;
  /** On a list selecting several items, how many are selected: the chip says so in place of the part (mobile D28). */
  selected?: number | null;
  /** On an item, what is typed in its comment box and not posted: the pill shows it in place of "Leave a comment…". */
  draft?: string;
}>();

const emit = defineEmits<{
  /** ⌘ or "Do or find…": the command menu. */
  menu: [];
  /** "Leave a comment…" or the draft: the item's composer. */
  comment: [];
}>();

const t = useTranslate();
const keyshortcuts = formatAriaKeyShortcuts(APP_KEYS.commandMenu);
const chip = computed((): PhonePart | null =>
  props.selected == null ? (props.part ?? null) : { label: t(l.selected, { count: props.selected }), count: null },
);
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
      <PhonePartChip
        v-if="chip"
        :part="chip"
      />
      <span :class="css.phoneCommandLine_placeholder">{{ t(l.doOrFind) }}</span>
    </PhonePill>
    <template v-else>
      <PhonePill
        :aria-label="draft?.trim() ? t(l.continueComment, { draft: draft.trim() }) : undefined"
        @click="emit('comment')"
      >
        <span
          v-if="draft?.trim()"
          :class="css.phoneCommandLine_draft"
          >{{ draft.trim() }}</span
        >
        <span
          v-else
          :class="css.phoneCommandLine_placeholder"
          >{{ t(l.leaveComment) }}</span
        >
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

.phoneCommandLine_placeholder,
.phoneCommandLine_draft {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// What is typed reads as text, not as the placeholder's hint.
.phoneCommandLine_draft {
  color: $color-fg;
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
