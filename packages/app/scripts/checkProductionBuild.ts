import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { checkAppSiteAssociation } from './checkAppSiteAssociation.js';
import { checkPrerenderedPages } from './checkPrerenderedPages.js';
import { readBuiltFiles, readBuiltPaths } from './readBuiltFiles.js';

// Runs after every production build (`bun --cwd packages/app build`, `GITHQ_TARGET=production`): proves that
// what the Worker will serve has nothing of local development or of the desktop app in it — the prerendered landing
// page (`_landing.html`) included — and that it has the SPA shell and the landing page (`checkPrerenderedPages.ts`).
// The sign-in with a pasted token is in `nuxt dev` and the local build only — the landing page imports it under
// `import.meta.dev || __LOCAL_BUILD__`, which the production build turns into `false`; the desktop code is in the
// desktop build only, behind `__DESKTOP__`, and the desktop links' web code in the web builds only, behind `!__DESKTOP__`.

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

/**
 * Text only the desktop code (`desktop/`) puts into a build: the native side Tauri injects into the desktop app's
 * window, the command the token is read with, the update notice with the command it restarts with, the toast after an update, and
 * Settings' Updates and Changelog sections. The production build must have none; the desktop build must have all (`checkDesktopBuild.ts`).
 */
export const DESKTOP_MARKERS: readonly { text: string; what: string }[] = [
    { text: '__TAURI_INTERNALS__', what: "Tauri's native side" },
    { text: 'token_load', what: "the desktop app's token vault" },
    { text: 'update_restart', what: "the desktop app's updater" },
    { text: 'read_job_log', what: "the desktop app's log reader" },
    { text: 'link_take', what: "the desktop app's opened links" },
    { text: 'UpdateSegment', what: "the desktop app's update notice" },
    { text: 'UpdatesSection', what: "Settings' Updates section" },
    { text: 'Official versions, released', what: "the text of Settings' Updates section" },
    { text: 'UpdatedToast', what: 'the toast saying the app updated' },
    { text: 'ChangelogSection', what: "Settings' Changelog section" },
    { text: 'changelog appears', what: "the text of Settings' Changelog section" },
];

/**
 * Text only the web code of the desktop links (`desktopLinks/`) puts into a build: the hand-off of a page's link to
 * the desktop app, its screen, the Settings switch and the command. The production build must have all (below);
 * the desktop build none (`checkDesktopBuild.ts`).
 */
export const WEB_ONLY_MARKERS: readonly { text: string; what: string }[] = [
    { text: 'DesktopHandOff', what: 'the hand-off of a link to the desktop app' },
    { text: 'githq.stayHere', what: "the hand-off's mark that a tab stays on the web" },
    { text: 'Open here instead', what: 'the text of the hand-off screen' },
    { text: 'OpenLinksSwitch', what: "Settings' switch to open links in the desktop app" },
    { text: 'Opens githq links', what: "the text of Settings' switch" },
    { text: 'app.openInDesktop', what: 'the command to open the screen in the desktop app' },
];

/** Text the app's sign-in puts into every build: without it the check would pass on files that are not the app. */
export const APP_MARKER = '/api/auth/authorize';

async function checkProductionBuild() {
    const files = await readBuiltFiles(OUTPUT);
    const paths = new Set(await readBuiltPaths(OUTPUT));

    const problems = checkPrerenderedPages(files, paths);
    // Read here: it has no extension, so it is not among `files`, and a build without it fails the read.
    const association = await readFile(path.join(OUTPUT, '.well-known/apple-app-site-association'), 'utf8');
    problems.push(...checkAppSiteAssociation(association, [...paths]));
    for (const file of files) {
        for (const { text, what } of [...DEV_SIGN_IN_MARKERS, ...DESKTOP_MARKERS]) {
            if (file.content.includes(text)) {
                problems.push(`${file.path}: ${what} (${text})`);
            }
        }
    }

    for (const { text, what } of [{ text: APP_MARKER, what: 'the sign-in' }, ...WEB_ONLY_MARKERS]) {
        if (!files.some(file => file.content.includes(text))) {
            problems.push(`${what} (${text}) is in none of the files`);
        }
    }

    if (problems.length > 0) {
        throw new Error(
            `The production build is not fit to ship:\n${problems.map(problem => `- ${problem}`).join('\n')}`,
        );
    }

    console.info(
        `Production build checked: ${files.length} files, the shell and the landing page, no development sign-in, no desktop code, the web-only desktop links, the Universal Links file.`,
    );
}

if (import.meta.main) {
    await checkProductionBuild();
}
