<!-- The default theme's layout with the docs' own parts in its slots: the wordmark and "Open githq" in the top bar, the search field atop the sidebar, the breadcrumb, the footer's edit link and date, the outline's links and the "not found" page. -->
<script lang="ts" setup>
import DefaultTheme from 'vitepress/theme';
import { computed } from 'vue';

import DocsBrand from './components/DocsBrand.vue';
import DocsBreadcrumb from './components/DocsBreadcrumb.vue';
import DocsFooterMeta from './components/DocsFooterMeta.vue';
import DocsNotFound from './components/DocsNotFound.vue';
import DocsOpenGithq from './components/DocsOpenGithq.vue';
import DocsOutlineLinks from './components/DocsOutlineLinks.vue';
import DocsSidebarSearch from './components/DocsSidebarSearch.vue';
import { usePageMeta } from './pageMeta.js';

const { Layout } = DefaultTheme;
const { section } = usePageMeta();

// The phone's bar under the top bar names the page's section (`styles/_phone.scss`). The bar is the default theme's,
// with no slot: the name reaches it as a CSS string, which `JSON.stringify` writes for a title.
const style = computed(() => ({ '--docs-section-title': section.value ? JSON.stringify(section.value.title) : '""' }));
</script>

<template>
  <Layout :style="style">
    <template #nav-bar-title-before>
      <DocsBrand />
    </template>
    <template #nav-bar-content-after>
      <DocsOpenGithq />
    </template>
    <template #sidebar-nav-before>
      <DocsSidebarSearch />
    </template>
    <template #doc-before>
      <DocsBreadcrumb />
    </template>
    <template #doc-footer-before>
      <DocsFooterMeta />
    </template>
    <template #aside-outline-after>
      <DocsOutlineLinks />
    </template>
    <template #not-found>
      <DocsNotFound />
    </template>
  </Layout>
</template>
