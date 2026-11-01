import path from 'node:path';

import { checkPrerenderedPages } from './checkPrerenderedPages.js';
import { APP_MARKER, DEV_SIGN_IN_MARKERS } from './checkProductionBuild.js';
import { readBuiltFiles } from './readBuiltFiles.js';

// Runs after every local build (`bun --cwd packages/app build:local`, `GITHQ_TARGET=local`): proves that the app
// the e2e tests run has the development sign-in, the SPA shell and the landing page (`checkPrerenderedPages.ts`).
// Its folder is not the one the Worker serves (`.output/public`).

const OUTPUT = path.join(import.meta.dirname, '../.output-local/public');

async function checkLocalBuild() {
    const files = await readBuiltFiles(OUTPUT);

    const problems = [
        ...checkPrerenderedPages(files),
        ...[...DEV_SIGN_IN_MARKERS, { text: APP_MARKER, what: 'the sign-in' }]
            .filter(({ text }) => !files.some(file => file.content.includes(text)))
            .map(({ text, what }) => `${what} (${text}) is in none of the files`),
    ];

    if (problems.length > 0) {
        throw new Error(
            `The local build is not fit for the e2e tests:\n${problems.map(problem => `- ${problem}`).join('\n')}`,
        );
    }

    console.info(
        `Local build checked: ${files.length} files, the shell and the landing page, with the development sign-in.`,
    );
}

if (import.meta.main) {
    await checkLocalBuild();
}
