<!-- The site's footer at the end of the home page: githq's licence, and links to its privacy page, its releases and its repository. -->
<script lang="ts" setup>
import { withBase } from 'vitepress';

import { GITHUB_URL, LICENSE_URL, RELEASES_URL } from '../../links.js';
</script>

<template>
  <footer :class="css.footer">
    <div :class="css.footer_inner">
      <p :class="css.footer_note">
        githq is open source under the
        <a
          :class="css.footer_inline"
          :href="LICENSE_URL"
          target="_blank"
          rel="noopener noreferrer"
          >AGPL-3.0</a
        >. These docs live in <code :class="css.footer_code">packages/docs</code> in the repository.
      </p>
      <ul :class="css.footer_links">
        <li>
          <a
            :class="css.footer_link"
            :href="withBase('/how-it-works/privacy-and-permissions')"
            >Privacy and permissions</a
          >
        </li>
        <li>
          <a
            :class="css.footer_link"
            :href="RELEASES_URL"
            target="_blank"
            rel="noopener noreferrer"
            >Releases</a
          >
        </li>
        <li>
          <a
            :class="css.footer_link"
            :href="GITHUB_URL"
            target="_blank"
            rel="noopener noreferrer"
            >GitHub</a
          >
        </li>
      </ul>
    </div>
  </footer>
</template>

<style lang="scss" module="css">
.footer {
  border-top: 1px solid $color-border;
}

// As wide as the home page's content (`DocsHome`).
.footer_inner {
  display: flex;
  box-sizing: content-box;
  max-width: 1120px;
  flex-wrap: wrap;
  gap: $spacing-12 $spacing-24;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-24;
  margin: 0 auto;

  font-size: $font-size-md;
  line-height: 20px;

  @media (width < 640px) {
    padding: $spacing-24 $spacing-16;
  }
}

.footer_note {
  margin: 0;
  color: $color-fg-dim;
}

.footer_inline {
  @include focus-ring;

  color: inherit;
  text-decoration: underline;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}

.footer_code {
  font-family: $font-family-mono;
  font-size: $font-size-sm;
}

.footer_links {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-8 $spacing-24;
  padding: 0;
  margin: 0;
  list-style: none;
}

.footer_link {
  @include focus-ring;

  color: $color-fg-2;
  text-decoration: none;
  border-radius: $radius-sm;

  &:hover {
    color: $color-fg;
  }
}
</style>
