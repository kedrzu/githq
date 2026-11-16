<!-- The rows under a place tapped open in the phone's places panel (`Sidebar`, mobile D53): a repository's sections or a project's saved views, each a link a finger's height with its icon, dimmer than a place's, and its tab's count, indented as "my work"'s groups with a thin line running down from the place's icon; the one shown filled and `aria-current`. A saved view GitHub answers has a cloud before its name (K6), one changed on this device a dot after it (D13); one leaving for github.com (`external`, mobile D21) is marked ↗ instead of a count. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, Cloud } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import * as l from './SidebarSubRows.loc.js';
import type { SidebarSubEntry } from './SidebarTypes.js';

defineProps<{
  entries: readonly SidebarSubEntry[];
}>();

const t = useTranslate();
</script>

<template>
  <ul :class="css.subRows">
    <li
      v-for="entry in entries"
      :key="entry.key"
    >
      <a
        v-if="entry.external"
        :href="entry.external"
        :class="css.subRows_row"
      >
        <component
          :is="entry.icon"
          :class="css.subRows_icon"
          aria-hidden="true"
        />
        <span :class="css.subRows_name">
          <span :class="css.subRows_label"
            >{{ entry.label }}<span :class="css.subRows_hidden"> {{ t(l.onGitHub) }}</span></span
          >
        </span>
        <ArrowUpRight
          :class="css.subRows_external"
          aria-hidden="true"
        />
      </a>
      <RouterLink
        v-else
        :to="entry.to"
        :class="[css.subRows_row, entry.current && css.subRows_row_current]"
        :aria-current="entry.current ? 'page' : undefined"
      >
        <component
          :is="entry.icon"
          :class="css.subRows_icon"
          aria-hidden="true"
        />
        <span :class="css.subRows_name">
          <Cloud
            v-if="entry.answered"
            :class="css.subRows_cloud"
            role="img"
            :aria-label="t(l.answeredByGitHub)"
          />
          <span :class="css.subRows_label">{{ entry.label }}</span>
          <span
            v-if="entry.modified"
            :class="css.subRows_modified"
            role="img"
            :aria-label="t(l.modifiedLocally)"
          />
        </span>
        <span :class="css.subRows_count">{{ entry.count }}</span>
      </RouterLink>
    </li>
  </ul>
</template>

<style lang="scss" module="css">
// The line runs down from the centre of the place's 18px icon, over the rows' fill.
.subRows {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-2 0 0;
  margin: 0;
  list-style: none;

  &::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 17px;
    z-index: 1;
    width: 1px;
    pointer-events: none;
    content: '';
    background: $color-border;
  }
}

// A finger's height, the text a phone's, indented as "my work"'s groups (mobile MB26).
.subRows_row {
  @include nav-row;

  min-height: $touch-target-size;
  padding-left: $spacing-24;
  font-size: $font-size-xl;
}

.subRows_row_current {
  @include nav-row-current;

  .subRows_icon {
    color: inherit;
  }
}

.subRows_icon {
  flex: none;
  width: 18px;
  height: 18px;
  color: $color-fg-3;
}

.subRows_name {
  display: flex;
  flex: 1;
  gap: $spacing-6;
  align-items: center;
  min-width: 0;
}

.subRows_label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subRows_cloud {
  flex: none;
  width: 13px;
  height: 13px;
  color: $color-amber;
}

.subRows_modified {
  flex: none;
  width: 6px;
  height: 6px;
  background: $color-accent;
  border-radius: 50%;
}

.subRows_count {
  @include nav-row-count;

  font-size: $font-size-sm;
}

.subRows_external {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-dim;
}

.subRows_hidden {
  @include visually-hidden;
}
</style>
