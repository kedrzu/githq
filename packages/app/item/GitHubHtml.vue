<!-- A body or a comment as GitHub rendered it (`bodyHTML`): GitHub turns the markdown into HTML and sanitizes it, and it is shown as given — never the markdown (`body`) rendered here, which nothing would sanitize. Only its links change: one to an address githq shows opens in githq (`GitHubLinks`), its `href` the app's path — re-pointed when what is tracked changes, for a repository's workflows are githq's only while it is tracked; the rest leave for a new tab without handing the app over (`noopener noreferrer`), and a footnote's stays on the page. Its images stay GitHub's. -->
<script lang="ts" setup>
import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import { onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { getGitHubLinkTarget, GITHQ_LINK_ATTRIBUTE } from '@/shell/gitHubLinks.js';
import GitHubLinks from '@/shell/GitHubLinks.vue';
import { TrackingStore } from '@/tracking/TrackingStore.js';

defineOptions({
  // On the HTML's own element, under its styles: a caller's class (the changelog's) sits where it always did.
  inheritAttrs: false,
});

const props = defineProps<{
  /** GitHub's `bodyHTML`, sanitized by GitHub. Only ever what GitHub returned. */
  html: string;
}>();

const router = useRouter();
const container = useContainer();
/** Read once a link needs it — a workflow's, githq's only while its repository is tracked; reactive. */
const trackingRef = shallowRef<TrackingStore | null>(null);
const rootRef = useTemplateRef<HTMLElement>('root');

onMounted(pointLinks);
// After the render: the HTML is drawn inside `GitHubLinks`, whose update this component's own hooks do not see.
watch([() => props.html, () => trackingRef.value?.repositories], pointLinks, { flush: 'post' });

/**
 * Points each link where it opens: githq's path, marked with GitHub's address it came from, or GitHub's address in a
 * new tab. Vue inserts GitHub's HTML as given; only these attributes of its links change, here.
 */
function pointLinks() {
  const params = { router, isTracked };
  for (const link of rootRef.value?.querySelectorAll('a[href]') ?? []) {
    const url = link.getAttribute(GITHQ_LINK_ATTRIBUTE) ?? link.getAttribute('href') ?? '';
    // A footnote's link stays on the page.
    if (url.startsWith('#')) {
      continue;
    }

    const target = getGitHubLinkTarget(url, params);
    if (target) {
      link.setAttribute(GITHQ_LINK_ATTRIBUTE, url);
      link.setAttribute('href', target.path);
      link.removeAttribute('target');
      link.removeAttribute('rel');
    } else {
      link.removeAttribute(GITHQ_LINK_ATTRIBUTE);
      link.setAttribute('href', url);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

function isTracked(nameWithOwner: string) {
  trackingRef.value ??= container.resolve(TrackingStore);
  return trackingRef.value.isTracked({ kind: 'repository', nameWithOwner });
}
</script>

<template>
  <GitHubLinks>
    <div
      v-bind="$attrs"
      ref="root"
      :class="css.gitHubHtml"
      v-html="html"
    />
  </GitHubLinks>
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
