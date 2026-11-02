<!-- The bar at the bottom of Settings' chooser while ticks differ from what is tracked (G8, D24): how many changes, naming what starts and stops being tracked (the first few, then how many more), that untracking deletes the copy in this browser when something is untracked, "Discard" (Esc) and "Save N changes" (⌘↵). The keys are the chooser's; the bar only draws them. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { Check, Pencil } from 'lucide-vue-next';
import { computed } from 'vue';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';

import * as l from './PendingChanges.loc.js';

/** How many names the summary gives before "+N more", so a long list stays one readable line. */
const NAMED = 3;

const props = defineProps<{
  /** What saving starts tracking, by name. */
  toTrack: readonly string[];
  /** What saving stops tracking, by name. */
  toUntrack: readonly string[];
  /** Saving is under way: "Save" waits, and "Discard" with it. */
  busy?: boolean;
}>();

const emit = defineEmits<{
  save: [];
  discard: [];
}>();

const t = useTranslate();

const count = computed(() => props.toTrack.length + props.toUntrack.length);
const summary = computed(() => {
  const tracked = props.toTrack.slice(0, NAMED);
  const untracked = props.toUntrack.slice(0, NAMED - tracked.length);
  const parts = [t(l.changes, { count: count.value })];
  if (tracked.length > 0) {
    parts.push(t(l.startTracking, { names: tracked.join(', ') }));
  }

  if (untracked.length > 0) {
    parts.push(t(l.stopTracking, { names: untracked.join(', ') }));
  }

  const more = count.value - tracked.length - untracked.length;
  if (more > 0) {
    parts.push(t(l.more, { count: more }));
  }

  return parts.join(' · ');
});
</script>

<template>
  <div
    :class="css.pendingChanges"
    role="region"
    :aria-label="t(l.label)"
  >
    <Pencil
      :class="css.pendingChanges_icon"
      aria-hidden="true"
    />
    <p :class="css.pendingChanges_summary">{{ summary }}</p>
    <p
      v-if="toUntrack.length > 0"
      :class="css.pendingChanges_note"
    >
      {{ t(l.untrackNote) }}
    </p>
    <span :class="css.pendingChanges_spacer" />
    <Button
      size="sm"
      kbd="Escape"
      aria-keyshortcuts="Escape"
      :disabled="busy"
      @click="emit('discard')"
    >
      {{ t(l.discard) }}
    </Button>
    <Button
      variant="light"
      size="sm"
      :icon="Check"
      kbd="Mod+Enter"
      :aria-keyshortcuts="formatAriaKeyShortcuts('Mod+Enter')"
      :busy="busy"
      @click="emit('save')"
    >
      {{ t(l.save, { count }) }}
    </Button>
  </div>
</template>

<style lang="scss" module="css">
.pendingChanges {
  display: flex;
  gap: $spacing-12;
  align-items: center;
  padding: 10px 14px;
  background: $color-bg-2;
  border: 1px solid $color-border-2;
  border-radius: $radius-lg;
}

.pendingChanges_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.pendingChanges_summary {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-sm;
  color: $color-fg-2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pendingChanges_note {
  flex: none;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.pendingChanges_spacer {
  flex: 1;
}
</style>
