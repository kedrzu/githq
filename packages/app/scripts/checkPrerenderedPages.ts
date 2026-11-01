import type { BuiltFile } from './readBuiltFiles.js';

/** The landing page's heading, as the server renders it (`landing/LandingScreen.loc.yaml`). */
const LANDING_HEADING = '>Your GitHub issues,';

/** The app's styles, linked by both pages (`features.inlineStyles` in `nuxt.config.ts`). */
const STYLESHEET = '<link rel="stylesheet" href="/_nuxt/entry.';

/** What the prerendered landing page must carry before any JavaScript runs: its heading and what previews read. */
const LANDING_MARKERS: readonly { text: string; what: string }[] = [
    { text: 'data-ssr="true"', what: 'the server-rendered payload' },
    { text: STYLESHEET, what: "the app's styles" },
    { text: LANDING_HEADING, what: 'the heading' },
    { text: '<link rel="canonical" href="https://githq.dev/">', what: 'the canonical address' },
    { text: '<meta property="og:title"', what: 'the Open Graph title' },
    { text: '<meta property="og:description"', what: 'the Open Graph description' },
    { text: '<meta property="og:image" content="https://githq.dev/og.png">', what: 'the Open Graph image' },
    { text: '<meta name="twitter:card" content="summary_large_image">', what: 'the Twitter card' },
    { text: '<meta name="twitter:image" content="https://githq.dev/og.png">', what: 'the Twitter card image' },
];

/**
 * Checks the two pages every build serves at `/` (`nuxt.config.ts`): `index.html`, the SPA shell every deep link
 * loads, which must hold nothing of the landing page, and `_landing.html`, the prerendered landing page the Worker
 * serves to a signed-out visitor. Returns what is wrong, empty when nothing is.
 */
export function checkPrerenderedPages(files: readonly BuiltFile[]): string[] {
    const problems = checkAppShell(files);

    const landing = files.find(file => file.path === '_landing.html');
    if (!landing) {
        problems.push('_landing.html (the prerendered landing page) is missing');
    } else {
        for (const { text, what } of LANDING_MARKERS) {
            if (!landing.content.includes(text)) {
                problems.push(`_landing.html: ${what} is missing (${text})`);
            }
        }
    }

    return problems;
}

/** Checks `index.html`, the SPA shell every build loads deep links with. Returns what is wrong, empty when nothing is. */
export function checkAppShell(files: readonly BuiltFile[]): string[] {
    const problems: string[] = [];

    const shell = files.find(file => file.path === 'index.html');
    if (!shell) {
        problems.push('index.html (the SPA shell) is missing');
    } else {
        if (!shell.content.includes('data-ssr="false"')) {
            problems.push('index.html: not the SPA shell (no data-ssr="false")');
        }
        if (!shell.content.includes(STYLESHEET)) {
            problems.push(`index.html: the app's styles are missing (${STYLESHEET})`);
        }
        if (shell.content.includes(LANDING_HEADING)) {
            problems.push('index.html: holds the landing page, deep links would paint it');
        }
    }

    return problems;
}
