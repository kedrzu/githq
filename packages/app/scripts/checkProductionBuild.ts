import path from 'node:path';

import { readBuiltFiles } from './readBuiltFiles.js';

// Runs after every production build (`bun --cwd packages/app build`, `GITHQ_TARGET=production`): proves that
// what the Worker will serve has nothing of local development in it. The sign-in with a pasted token is in
// `nuxt dev` and the local build only — the landing page imports it under `import.meta.dev || __LOCAL_BUILD__`,
// which the production build turns into `false`.

const OUTPUT = path.join(import.meta.dirname, '../.output/public');

/**
 * Text only the development sign-in (`auth/DevTokenForm.vue`) puts into a build: its chunk's name and pieces of
 * its texts. Pieces without short words, which the translation compiler glues with no-break spaces (and the
 * build may write as escapes). The production build must have none, the local one
 * all (`checkLocalBuild.ts`) — which also proves they are found when there.
 */
export const DEV_SIGN_IN_MARKERS: readonly { text: string; what: string }[] = [
    { text: 'DevTokenForm', what: 'the development sign-in form' },
    { text: '(dev only)', what: 'the development sign-in title' },
    { text: 'read:org scopes, e.g.', what: 'the development sign-in hint' },
];

/** Text the app's sign-in puts into every build: without it the check would pass on files that are not the app. */
export const APP_MARKER = '/api/auth/authorize';

async function checkProductionBuild() {
    const files = await readBuiltFiles(OUTPUT);

    const problems: string[] = [];
    for (const file of files) {
        for (const { text, what } of DEV_SIGN_IN_MARKERS) {
            if (file.content.includes(text)) {
                problems.push(`${file.path}: ${what} (${text})`);
            }
        }
    }

    if (!files.some(file => file.content.includes(APP_MARKER))) {
        problems.push(`the sign-in (${APP_MARKER}) is in none of the files`);
    }

    if (problems.length > 0) {
        throw new Error(
            `The production build is not fit to ship:\n${problems.map(problem => `- ${problem}`).join('\n')}`,
        );
    }

    console.info(`Production build checked: ${files.length} files, no development sign-in.`);
}

if (import.meta.main) {
    await checkProductionBuild();
}
