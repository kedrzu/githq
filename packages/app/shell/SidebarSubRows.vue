<!-- The rows under a place expanded in the sidebar (`Sidebar`): a repository's sections or a project's saved views, each a link with its icon, smaller and dimmer than a place's, and its tab's count, indented to the place's name with a thin line running down from the place's icon; the one shown filled and `aria-current`. A saved view GitHub answers has a cloud before its name (K6), one changed on this device a dot after it (D13); a repository's Workflows with broken ones the red dot of "Broken workflows" (actions W1). On a phone (`phone`) the rows are a finger's height, and one leaving for github.com (`external`, mobile D21) is marked ↗ instead of a count. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { ArrowUpRight, Cloud } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

import * as l from './SidebarSubRows.loc.js';
import type { SidebarSubEntry } from './SidebarTypes.js';

defineProps<{
  entries: readonly SidebarSubEntry[];
  /** The phone's places panel: rows a finger's height. */
  phone?: boolean;
}>();

const t = useTranslate();
</script>

<template>
  <ul :class="[css.subRows, phone && css.subRows_phone]">
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
        <span
          v-if="entry.marker"
          :class="[css.subRows_broken, css[`subRows_broken_${entry.marker}`]]"
          aria-hidden="true"
        />
        <span :class="css.subRows_count">{{ entry.count }}</span>
      </RouterLink>
    </li>
  </ul>
</template>

<style lang="scss" module="css">
// The line runs down from the centre of the place's icon (the row's padding and half its 15px icon), over the rows' fill.
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
    left: 15px;
    z-index: 1;
    width: 1px;
    pointer-events: none;
    content: '';
    background: $color-border;
  }
}

// Indented to the place's name: the place row's padding, its icon and their gap.
.subRows_row {
  @include nav-row;

  padding-left: 32px;
}

.subRows_row_current {
  @include nav-row-current;

  .subRows_icon {
    color: inherit;
  }
}

.subRows_icon {
  flex: none;
  width: 13px;
  height: 13px;
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

.subRows_broken {
  @include workflow-broken-marker;
}

.subRows_broken_settled {
  background: $color-red-quiet;
}

.subRows_count {
  @include nav-row-count;
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

// The phone's rows (mobile MB26): a finger's height, the text a phone's, indented as "my work"'s groups; the line from
// the centre of the place's 18px icon.
.subRows_phone {
  &::before {
    left: 17px;
  }

  .subRows_row {
    min-height: $touch-target-size;
    padding-left: $spacing-24;
    font-size: $font-size-xl;
  }

  .subRows_icon {
    width: 18px;
    height: 18px;
  }

  .subRows_count {
    font-size: $font-size-sm;
  }
}
</style>
