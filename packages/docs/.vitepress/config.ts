import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitepress';

import { assertFullGitHistory, gitIn } from '../lib/gitHistory.js';
import { articleMetaPlugin, codeTitlePlugin } from '../lib/markdown.js';
import { readingMinutes } from '../lib/readingTime.js';
import { EDIT_URL_PATTERN, GITHUB_URL } from './links.js';
import { firstPage, sections } from './sections.js';

// The app's design tokens (SCSS variables and mixins only, no CSS), available in the theme's components' SCSS blocks;
// the partials of `theme/styles/` load them themselves.
const tokensPath = fileURLToPath(new URL('../../app/styles/tokens.scss', import.meta.url));
const themePath = fileURLToPath(new URL('theme/', import.meta.url));

const git = gitIn(fileURLToPath(new URL('..', import.meta.url)));
assertFullGitHistory(git);

export default defineConfig({
    title: 'githq docs',
    description: 'How to use githq, the keyboard-first command center for GitHub.',
    lang: 'en-US',

    srcDir: 'src',
    // No home page: `/docs/` is the sidebar's first page, its file served as `index.md`. A link to the address its folder
    // would give it (`/getting-started/what-is-githq`) passes the dead-link check yet 404s: link to its file or to `/`.
    rewrites: { [firstPage.file]: 'index.md' },
    outDir: 'dist',
    // Served by the app's Worker under githq.dev/docs; `cleanUrls` makes `/docs/x` serve `docs/x.html`.
    base: '/docs/',
    cleanUrls: true,
    // Left at the default on purpose: a dead link fails the build.
    ignoreDeadLinks: false,

    appearance: 'force-dark',
    // "Updated" dates come from git; `assertFullGitHistory` above keeps a shallow clone from faking them.
    lastUpdated: true,

    markdown: {
        // One theme: the site is dark only. GitHub's own dark theme, whose comments still pass AA on a code block.
        theme: 'github-dark-default',
        container: { infoLabel: 'Note', tipLabel: 'Tip', warningLabel: 'Warning', dangerLabel: 'Danger' },
        config: md => {
            md.use(articleMetaPlugin);
            md.use(codeTitlePlugin);
        },
    },

    // The article's meta line and footer (`theme/pageMeta.ts`): its reading time and the commit it was last changed in.
    transformPageData: (pageData, { siteConfig }) => {
        if (!pageData.filePath) {
            return;
        }
        const file = join(siteConfig.srcDir, pageData.filePath);
        const commit = git(['log', '-1', '--format=%h', '--', file]).trim();
        pageData.frontmatter.readingMinutes = readingMinutes(readFileSync(file, 'utf8'));
        pageData.frontmatter.commit = commit || undefined;
    },

    // VitePress renders the "not found" page (`theme/components/DocsNotFound.vue`) but writes `404.html` with an empty
    // `#app`, to fill in the browser. The Worker returns that file for an unknown `/docs/…` address: it carries the page
    // itself, so it reads without JavaScript and doesn't flash empty; the browser hydrates it as the same page.
    transformHtml: (html, _file, { page, content }) =>
        page === '404.md' ? html.replace('<div id="app"></div>', () => `<div id="app">${content}</div>`) : undefined,

    vite: {
        // The dev server (port 8789, `package.json`) is also reached through `nuxt dev` on 8787, which proxies
        // `/docs/**` here (`packages/app/nuxt.config.ts`) but cannot carry a WebSocket: the HMR socket goes to
        // 8789 straight away, instead of first trying 8787 and failing there.
        server: { hmr: { clientPort: 8789 } },
        css: {
            preprocessorOptions: {
                scss: {
                    api: 'modern',
                    additionalData: (source: string, filename: string) =>
                        filename.startsWith(themePath) ? `@use '${tokensPath}' as *;\n${source}` : source,
                },
            },
        },
    },

    themeConfig: {
        nav: sections.map(section => ({
            text: section.title,
            link: section.pages[0]?.link ?? '/',
            // The first section's first page is `/`.
            activeMatch: section.pages.some(page => page === firstPage) ? `^/(${section.id}/|$)` : `^/${section.id}/`,
        })),
        sidebar: sections.map(section => ({
            text: section.title,
            items: section.pages.map(page => ({ text: page.title, link: page.link })),
        })),
        outline: { level: [2, 3], label: 'On this page' },
        search: {
            provider: 'local',
            options: {
                // Each result shows its text around the match (`DOC4`), always: `theme/styles/_search.scss` hides the
                // toggle.
                detailedView: true,
                translations: {
                    // No label of its own: the button is named by what it shows, its keys included, as a name that leaves
                    // them out would not match its visible text (axe's `label-content-name-mismatch`).
                    button: { buttonText: 'Search the docs', buttonAriaLabel: '' },
                    modal: {
                        noResultsText: 'Nothing in the docs for',
                        footer: { navigateText: 'Move', selectText: 'Open', closeText: 'Close' },
                    },
                },
            },
        },
        editLink: { pattern: EDIT_URL_PATTERN, text: 'Edit this page on GitHub' },
        docFooter: { prev: 'Previous', next: 'Next' },
        // The wordmark stands in for the title (`theme/DocsBrand.vue`).
        siteTitle: false,
        socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    },
});
