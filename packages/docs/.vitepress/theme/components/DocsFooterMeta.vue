<!-- The footer's first line (`Docs / Page footer`): the edit link, and when and in which commit the page last changed. It stands for the default theme's own line, which `styles/footer.scss` hides: that one prints "Updated:" and its date only once the page is running. -->
<script lang="ts" setup>
import { Pencil } from 'lucide-vue-next';

import { usePageMeta } from '../pageMeta.js';

const { updated, commit, editUrl } = usePageMeta();
</script>

<template>
  <div
    v-if="editUrl || updated"
    :class="css.footerMeta"
  >
    <a
      v-if="editUrl"
      :class="css.footerMeta_edit"
      :href="editUrl"
      target="_blank"
      rel="noopener noreferrer"
      tid="docs-edit-link"
    >
      <Pencil
        :class="css.footerMeta_icon"
        aria-hidden="true"
      />
      Edit this page on GitHub
    </a>
    <p
      v-if="updated"
      :class="css.footerMeta_updated"
      tid="docs-updated"
    >
      Updated <time :datetime="updated.iso">{{ updated.text }}</time><template v-if="commit"> · {{ commit }}</template>
    </p>
  </div>
</template>

<style lang="scss" module="css">
.footerMeta {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8 $spacing-16;
  align-items: center;
  justify-content: space-between;
  padding-top: $spacing-16;
  margin-bottom: $spacing-24;
  font-size: $font-size-md;
  line-height: 20px;
  border-top: 1px solid $color-border;
}

.footerMeta_edit {
  @include focus-ring;

  display: inline-flex;
  gap: $spacing-8;
  align-items: center;
  color: $color-accent;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    text-decoration: underline;
  }
}

.footerMeta_icon {
  flex: none;
  width: 14px;
  height: 14px;
}

.footerMeta_updated {
  margin: 0;
  color: $color-fg-dim;
}
</style>
