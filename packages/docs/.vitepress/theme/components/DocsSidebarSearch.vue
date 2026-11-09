<!-- The search field atop the sidebar (`Docs / Search field`), on a wide page and in the phone's menu alike: it opens the default theme's search, as ⌘K does. Picking a page closes both. -->
<script lang="ts" setup>
import { Command, Search } from 'lucide-vue-next';

import { openSearch } from '../search.js';
</script>

<template>
  <button
    :class="css.search"
    type="button"
    tid="docs-sidebar-search"
    @click="openSearch"
  >
    <Search
      :class="css.search_icon"
      aria-hidden="true"
    />
    <span :class="css.search_placeholder">Search the docs</span>
    <!-- One key (`Kbd / icon + key`): the modifier and K together, "⌘K" on a Mac (the default theme's `mac` class on `html`), "Ctrl K" elsewhere. -->
    <kbd
      :class="css.search_key"
      aria-hidden="true"
    >
      <Command :class="css.search_command" />
      <span :class="css.search_ctrl">Ctrl</span>
      K
    </kbd>
  </button>
</template>

<style lang="scss" module="css">
.search {
  @include focus-ring;

  display: flex;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  padding: 7px $spacing-8 7px $spacing-10;
  margin-bottom: $spacing-20;
  font-size: $font-size-lg;
  line-height: 20px;
  color: $color-fg-dim;
  text-align: left;
  cursor: text;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &:hover {
    color: $color-fg-2;
    border-color: $color-border-2;
  }
}

.search_icon {
  flex: none;
  width: 15px;
  height: 15px;
}

.search_placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search_key {
  // The chip is every `kbd`'s (`styles/_base.scss`, which outweighs one class): this lays the icon and K in a row.
  .search & {
    display: flex;
    flex: none;
    gap: 1px;
    align-items: center;
  }

  // A phone has no keyboard to press it on.
  @media (width < 640px) {
    .search & {
      display: none;
    }
  }
}

.search_command {
  display: none;
  width: 11px;
  height: 11px;
}

.search_ctrl {
  margin-right: 3px;
}

:global(.mac) .search_command {
  display: block;
}

:global(.mac) .search_ctrl {
  display: none;
}
</style>
