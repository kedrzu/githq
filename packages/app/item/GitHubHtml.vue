<!-- A body or a comment as GitHub rendered it (`bodyHTML`): GitHub turns the markdown into HTML and sanitizes it, and it is shown as given — never the markdown (`body`) rendered here, which nothing would sanitize. Its links leave for a new tab without handing the app over (`noopener noreferrer`); its images stay GitHub's. -->
<script lang="ts" setup>
import { onMounted, onUpdated, useTemplateRef } from 'vue';

defineProps<{
  /** GitHub's `bodyHTML`, sanitized by GitHub. Only ever what GitHub returned. */
  html: string;
}>();

const rootRef = useTemplateRef<HTMLElement>('root');

onMounted(openLinksOutside);
onUpdated(openLinksOutside);

function openLinksOutside() {
  for (const link of rootRef.value?.querySelectorAll('a[href]') ?? []) {
    // A footnote's link stays on the page.
    if (link.getAttribute('href')?.startsWith('#')) {
      continue;
    }

    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
}
</script>

<template>
  <div
    ref="root"
    :class="css.gitHubHtml"
    v-html="html"
  />
</template>

<style lang="scss" module="css">
.gitHubHtml {
  font-size: $font-size-md;
  line-height: 20px;
  color: $color-fg-2;
  overflow-wrap: anywhere;

  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }

  :global {
    p,
    ul,
    ol,
    blockquote,
    pre,
    table,
    details {
      margin: 0 0 $spacing-10;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: $spacing-16 0 $spacing-8;
      font-size: $font-size-lg;
      font-weight: $font-weight-semibold;
      color: $color-fg;
    }

    h1 {
      font-size: $font-size-xl;
    }

    ul,
    ol {
      padding-left: 20px;
    }

    a {
      color: $color-accent;
      text-decoration: underline;
      text-decoration-color: rgba($color-accent, 0.4);
      text-underline-offset: 2px;

      &:hover {
        text-decoration-color: currentcolor;
      }
    }

    strong {
      color: $color-fg;
    }

    code {
      padding: 1px 4px;
      font-family: $font-family-mono;
      font-size: 0.9em;
      background: $color-bg-3;
      border-radius: $radius-sm;
    }

    pre {
      padding: $spacing-8 $spacing-10;
      overflow-x: auto;
      background: $color-bg-3;
      border-radius: $radius-md;

      code {
        padding: 0;
        background: none;
      }
    }

    blockquote {
      padding-left: $spacing-10;
      color: $color-fg-dim;
      border-left: 2px solid $color-border-2;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    table {
      display: block;
      overflow-x: auto;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 4px $spacing-8;
      border: 1px solid $color-border-2;
    }

    hr {
      height: 1px;
      margin: $spacing-12 0;
      background: $color-border;
      border: 0;
    }

    input[type='checkbox'] {
      margin-right: $spacing-6;
      vertical-align: middle;
    }
  }
}
</style>
