// The docs' theme: VitePress's default theme in the landing page's look (githq.pen "Docs · githq.dev/docs —
// template"). Its colours and type come from the app's tokens (`styles/vars.scss`); its own parts are in `components/`,
// put into the default theme's slots by `DocsLayout.vue`.
import '@fontsource/geist/500.css';
import '@fontsource/geist/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/main.scss';

import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

import { ARTICLE_META_TAG } from '../../lib/markdown.js';
import ArticleMeta from './components/ArticleMeta.vue';
import DocsLayout from './DocsLayout.vue';

export default {
    extends: DefaultTheme,
    Layout: DocsLayout,
    enhanceApp({ app }) {
        app.component(ARTICLE_META_TAG, ArticleMeta);
    },
} satisfies Theme;
