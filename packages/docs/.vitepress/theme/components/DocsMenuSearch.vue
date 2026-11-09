<!-- The search field atop the phone's menu (`Docs / Search field`): it opens the default theme's search over the menu, as ⌘K does. Picking a page closes both. -->
<script lang="ts" setup>
import { Search } from 'lucide-vue-next';

function openSearch() {
  // The default theme's search opens on ⌘K and offers no other way in from outside its button.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
}
</script>

<template>
  <button
    :class="css.search"
    type="button"
    tid="docs-menu-search"
    @click="openSearch"
  >
    <Search
      :class="css.search_icon"
      aria-hidden="true"
    />
    <span :class="css.search_placeholder">Search the docs</span>
    <span
      :class="css.search_keys"
      aria-hidden="true"
    >
      <kbd :class="css.search_mod" /><kbd>K</kbd>
    </span>
  </button>
</template>

<style lang="scss" module="css">
.search {
  @include focus-ring;

  display: none;
  gap: $spacing-8;
  align-items: center;
  width: 100%;
  padding: 7px $spacing-8 7px $spacing-10;
  margin-bottom: $spacing-20;
  font-size: $font-size-lg;
  line-height: 20px;
  color: $color-fg-dim;
  text-align: left;
  background: $color-bg-2;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &:hover {
    border-color: $color-border-2;
  }

  @media (width < 960px) {
    display: flex;
  }
}

.search_icon {
  flex: none;
  width: 15px;
  height: 15px;
}

.search_placeholder {
  flex: 1;
}

.search_keys {
  display: flex;
  gap: 3px;
}

// The modifier as the default theme's search button writes it: "⌘" on a Mac (its `mac` class on `html`), "Ctrl" elsewhere.
.search_mod::after {
  content: 'Ctrl';
}

:global(.mac) .search_mod::after {
  content: '⌘';
}
</style>
