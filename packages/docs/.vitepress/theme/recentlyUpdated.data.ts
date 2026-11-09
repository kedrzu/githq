// The home page's "Recently updated": a VitePress data loader, run in Node when the site builds (and again in `dev`
// whenever a page changes), its result inlined into the page as JSON.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineLoader } from 'vitepress';

import { gitIn } from '../../lib/gitHistory.js';
import type { RecentPage } from '../../lib/recentlyUpdated.js';
import { recentPages } from '../../lib/recentlyUpdated.js';
import { sections } from '../sections.js';

/** The pages listed under "Recently updated". */
const LIMIT = 5;

declare const data: RecentPage[];
export { data };

const srcDir = fileURLToPath(new URL('../../src/', import.meta.url));

export default defineLoader({
    // The pages' files, and `sections.ts`, which lists them (the loader's own imports aren't watched).
    watch: ['../../src/**/*.md', '../sections.ts'],
    load: () =>
        recentPages(sections, {
            // The config's `assertFullGitHistory` has made sure the history is all there.
            runGit: gitIn(srcDir),
            fileExists: existsSync,
            fileOf: link => join(srcDir, `${link}.md`),
            limit: LIMIT,
        }),
});
