<!-- A tracked repository's or project's row in Settings (G8 `CqvD4`, T17 `L5sxR`; selected `Dht0d`, `jbKD6`): its icon, name (a project's with its mono `#number`) and visibility tag, then on the right where its items come from (a project's), how many it holds, how it stands (`TrackedRowNote`), Untrack ⌫ — shown on the hovered and on the selected row — and the chevron saying the row opens its settings. The list (`TrackedListView`) opens it and runs the keys. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import { ChevronRight } from 'lucide-vue-next';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import Button from '@/components/Button.vue';

import * as l from './TrackedRow.loc.js';
import TrackedRowNote from './TrackedRowNote.vue';
import type { TrackedStatus } from './TrackingTypes.js';

/** The key of Untrack, on the selected row. */
const UNTRACK_KEY = 'Backspace';

defineProps<{
  icon: LucideIcon;
  /** A repository's name (its owner is the group's), a project's title. */
  title: string;
  /** A project's number, after its title. */
  number?: number;
  /** "public", "private"; none while not known. */
  badge?: string;
  /** Where a project's items come from: "from fitloop/webapp". */
  source?: string;
  /** How many it holds: "18 open", "34 items". */
  count: string;
  status: TrackedStatus;
  /** What "synced 14s ago" is counted from. */
  now: number;
  selected?: boolean;
}>();

const emit = defineEmits<{
  untrack: [];
}>();

const t = useTranslate();
</script>

<template>
  <div :class="[css.trackedRow, selected && css.trackedRow_selected]">
    <component
      :is="icon"
      :class="css.trackedRow_icon"
      aria-hidden="true"
    />
    <span :class="css.trackedRow_title">{{ title }}</span>
    <span
      v-if="number !== undefined"
      :class="css.trackedRow_number"
      >#{{ number }}</span
    >
    <span
      v-if="badge"
      :class="css.trackedRow_badge"
      >{{ badge }}</span
    >
    <span :class="css.trackedRow_spacer" />
    <span
      v-if="source"
      :class="css.trackedRow_source"
      >{{ source }}</span
    >
    <span :class="css.trackedRow_count">{{ count }}</span>
    <span :class="css.trackedRow_sync">
      <TrackedRowNote
        :status="status"
        :now="now"
      />
    </span>
    <span :class="css.trackedRow_actions">
      <Button
        variant="outline"
        size="sm"
        :kbd="UNTRACK_KEY"
        :aria-keyshortcuts="selected ? formatAriaKeyShortcuts(UNTRACK_KEY) : undefined"
        :class="css.trackedRow_untrack"
        @click="emit('untrack')"
      >
        {{ t(l.untrack) }}
      </Button>
      <ChevronRight
        :class="css.trackedRow_chevron"
        aria-hidden="true"
      />
    </span>
  </div>
</template>

<style lang="scss" module="css">
.trackedRow {
  display: flex;
  gap: $spacing-10;
  align-items: center;
  height: 36px;
  padding: 0 $spacing-12;
  font-size: $font-size-sm;
  white-space: nowrap;
  cursor: pointer;
  border-radius: $radius-md;

  &:hover {
    background: $color-bg-3;
  }
}

.trackedRow.trackedRow_selected {
  background: $color-sel;
}

.trackedRow_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}

.trackedRow_title {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-md;
  font-weight: $font-weight-medium;
  color: $color-fg;
  text-overflow: ellipsis;
}

.trackedRow_number {
  flex: none;
  margin-left: -$spacing-4;
  font-family: $font-family-mono;
  font-size: $font-size-xs;
  color: $color-fg-dim;
}

.trackedRow_badge {
  flex: none;
  padding: 0 $spacing-6;
  font-size: 11px;
  line-height: 15px;
  color: $color-fg-dim;
  border: 1px solid $color-border-2;
  border-radius: $radius-sm;
}

.trackedRow_spacer {
  flex: 1;
}

.trackedRow_source {
  min-width: 0;
  overflow: hidden;
  font-size: $font-size-xs;
  color: $color-fg-dim;
  text-overflow: ellipsis;
}

.trackedRow_count,
.trackedRow_sync {
  flex: none;
  text-align: right;
}

.trackedRow_count {
  width: 80px;
  color: $color-fg-dim;
}

.trackedRow_sync {
  width: 120px;
}

.trackedRow_actions {
  display: flex;
  flex: none;
  gap: $spacing-6;
  align-items: center;
  justify-content: flex-end;
  width: 118px;
}

// Shown on the hovered and the selected row; out of the way, and of the tab order, elsewhere.
.trackedRow_untrack {
  visibility: hidden;

  .trackedRow:hover &,
  .trackedRow_selected & {
    visibility: visible;
  }
}

.trackedRow_chevron {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}
</style>
