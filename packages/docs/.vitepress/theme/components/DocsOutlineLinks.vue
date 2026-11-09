<!-- Under the outline (`Docs / Outline`): edit the page, report a problem with it, back to the top. -->
<script lang="ts" setup>
import { ArrowUp, Bug, Pencil } from 'lucide-vue-next';

import { NEW_ISSUE_URL } from '../../links.js';
import { usePageMeta } from '../pageMeta.js';

const { editUrl } = usePageMeta();

function backToTop() {
  window.scrollTo({ top: 0 });
}
</script>

<template>
  <!-- A landmark of its own: the outline's `nav` ends before this slot. -->
  <nav aria-label="This page">
    <ul :class="css.links">
      <li v-if="editUrl">
        <a
          :class="css.links_link"
          :href="editUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Pencil
            :class="css.links_icon"
            aria-hidden="true"
          />
          Edit this page on GitHub
        </a>
      </li>
      <li>
        <a
          :class="css.links_link"
          :href="NEW_ISSUE_URL"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Bug
            :class="css.links_icon"
            aria-hidden="true"
          />
          Report a problem
        </a>
      </li>
      <li>
        <button
          :class="css.links_link"
          type="button"
          @click="backToTop"
        >
          <ArrowUp
            :class="css.links_icon"
            aria-hidden="true"
          />
          Back to top
        </button>
      </li>
    </ul>
  </nav>
</template>

<style lang="scss" module="css">
.links {
  display: flex;
  flex-direction: column;
  gap: $spacing-10;
  padding: $spacing-16 0 0;
  margin: $spacing-20 0 0;
  list-style: none;
  border-top: 1px solid $color-border;
}

.links_link {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
  font-size: $font-size-md;
  line-height: 18px;
  color: $color-fg-2;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}

.links_icon {
  flex: none;
  width: 14px;
  height: 14px;
  color: $color-fg-3;
}
</style>
