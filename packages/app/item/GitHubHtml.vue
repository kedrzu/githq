<!-- A body or a comment as GitHub rendered it (`bodyHTML`): GitHub turns the markdown into HTML and sanitizes it, and it is shown as given — never the markdown (`body`) rendered here, which nothing would sanitize. Only its links change: one to an address githq shows opens in githq (`GitHubLinks`), its `href` the app's path — re-pointed when what is tracked changes, for a repository's workflows are githq's only while it is tracked; the rest leave for a new tab without handing the app over (`noopener noreferrer`), and a footnote's stays on the page. On a phone a link that leaves for github.com — to what githq has no screen for, or the phone doesn't show and hands off (a commit, a pull request's changed files, a run) — ends in ↗ and says so to a screen reader (mobile D3, D11). Its images stay GitHub's. -->
<script lang="ts" setup>
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useContainer } from '@nzyme/vue-ioc/useContainer.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';

import { getGitHubLinkTarget, GITHQ_LINK_ATTRIBUTE, isGitHubLinkLeavingOnPhone } from '@/shell/gitHubLinks.js';
import GitHubLinks from '@/shell/GitHubLinks.vue';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import * as l from './GitHubHtml.loc.js';

/** Marks a link that leaves for github.com on a phone: it ends in ↗ (mobile D11). */
const LEAVES_ATTRIBUTE = 'data-leaves';

defineOptions({
  // On the HTML's own element, under its styles: a caller's class (the changelog's) sits where it always did.
  inheritAttrs: false,
});

const props = defineProps<{
  /** GitHub's `bodyHTML`, sanitized by GitHub. Only ever what GitHub returned. */
  html: string;
}>();

const t = useTranslate();
const router = useRouter();
const phone = useService(PhoneLayout);
const container = useContainer();
/** Read once a link needs it — a workflow's, githq's only while its repository is tracked; reactive. */
const trackingRef = shallowRef<TrackingStore | null>(null);
const rootRef = useTemplateRef<HTMLElement>('root');

onMounted(pointLinks);
// After the render: the HTML is drawn inside `GitHubLinks`, whose update this component's own hooks do not see.
watch([() => props.html, () => trackingRef.value?.repositories, () => phone.active], pointLinks, { flush: 'post' });

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

    if (phone.active && isGitHubLinkLeavingOnPhone(url, params)) {
      link.setAttribute(LEAVES_ATTRIBUTE, '');
      link.setAttribute('aria-description', t(l.leaves));
    } else {
      link.removeAttribute(LEAVES_ATTRIBUTE);
      link.removeAttribute('aria-description');
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
// What people wrote, in the Reading role; a caller sets the colour with `--github-html-color`. A caller needing another
// size (a phone's editor, at 16px) sets `--font-size-reading` on it: the headings follow.
.gitHubHtml {
  font-family: $font-family-reading;
  font-size: $font-size-reading;
  line-height: $line-height-reading;
  color: var(--github-html-color, #{$color-fg-2});
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
      font-size: $font-size-reading-heading;
      font-weight: $font-weight-semibold;
      color: $color-fg;
    }

    h1 {
      font-size: $font-size-reading-title;
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

    // Lucide's arrow-up-right, in the link's colour; the link's description says it to a screen reader.
    a[data-leaves]::after {
      display: inline-block;
      width: 1em;
      height: 1em;
      margin-left: 0.15em;
      vertical-align: -0.125em;
      content: '';
      background: currentcolor;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 7h10v10'/%3E%3Cpath d='M7 17 17 7'/%3E%3C/svg%3E")
        center / contain no-repeat;
    }

    strong {
      color: $color-fg;
    }

    code {
      padding: 1px 4px;
      font-family: $font-family-mono;
      font-size: 0.85em;
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
