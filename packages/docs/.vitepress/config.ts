import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitepress';

import { assertFullGitHistory, gitIn } from '../lib/gitHistory.js';
import { sections } from './sections.js';

const GITHUB_URL = 'https://github.com/kedrzu/githq';

assertFullGitHistory(gitIn(fileURLToPath(new URL('..', import.meta.url))));

export default defineConfig({
    title: 'githq docs',
    description: 'How to use githq, the keyboard-first command center for GitHub.',
    lang: 'en-US',

    srcDir: 'src',
    outDir: 'dist',
    // Served by the app's Worker under githq.dev/docs; `cleanUrls` makes `/docs/x` serve `docs/x.html`.
    base: '/docs/',
    cleanUrls: true,
    // Left at the default on purpose: a dead link fails the build.
    ignoreDeadLinks: false,

    appearance: 'force-dark',
    // "Updated" dates come from git; `assertFullGitHistory` above keeps a shallow clone from faking them.
    lastUpdated: true,

    themeConfig: {
        nav: sections.map(section => ({
            text: section.title,
            link: section.pages[0]?.link ?? '/',
            activeMatch: `^/${section.id}/`,
        })),
        sidebar: sections.map(section => ({
            text: section.title,
            items: section.pages.map(page => ({ text: page.title, link: page.link })),
        })),
        search: { provider: 'local' },
        editLink: {
            pattern: `${GITHUB_URL}/edit/main/packages/docs/src/:path`,
            text: 'Edit this page',
        },
        socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    },
});
