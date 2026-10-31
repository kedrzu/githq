import path from 'node:path';

import { APP_MARKER, DESKTOP_MARKERS, DEV_SIGN_IN_MARKERS } from './checkProductionBuild.js';
import { readBuiltFiles } from './readBuiltFiles.js';

// Runs after every desktop build (`bun --cwd packages/app build:desktop`, `GITHQ_TARGET=desktop`): proves that the
// app the desktop app bundles (`packages/desktop`) is the app, with its desktop code and without the development
// sign-in. Its folder is not the one the Worker serves (`.output/public`).

const OUTPUT = path.join(import.meta.dirname, '../.output-desktop/public');

async function checkDesktopBuild() {
    const files = await readBuiltFiles(OUTPUT);

    const problems: string[] = [];
    for (const { text, what } of [{ text: APP_MARKER, what: 'the sign-in' }, ...DESKTOP_MARKERS]) {
        if (!files.some(file => file.content.includes(text))) {
            problems.push(`${what} (${text}) is in none of the files`);
        }
    }

    for (const file of files) {
        for (const { text, what } of DEV_SIGN_IN_MARKERS) {
            if (file.content.includes(text)) {
                problems.push(`${file.path}: ${what} (${text})`);
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(`The desktop build is not fit to ship:\n${problems.map(problem => `- ${problem}`).join('\n')}`);
    }

    console.info(`Desktop build checked: ${files.length} files, with the desktop code, no development sign-in.`);
}

if (import.meta.main) {
    await checkDesktopBuild();
}
