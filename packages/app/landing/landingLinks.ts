/** The repository on GitHub: "Star on GitHub", the navigation's GitHub mark and every other way out to GitHub. */
export const REPOSITORY_URL = 'https://github.com/kedrzu/githq';

/** Why githq asks for what it does — the design's "What githq keeps in your browser", until a page of its own. */
export const WHY_URL = `${REPOSITORY_URL}/blob/main/docs/design/githq/README.md#what-githq-keeps-in-your-browser`;

/** The footer's "Issues": githq's own tracker. */
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;

/** The footer's "Design docs": the design folder githq is built from. */
export const DESIGN_DOCS_URL = `${REPOSITORY_URL}/tree/main/docs/design/githq`;

/** The footer's "Releases". */
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;

/** The footer's feed icon: GitHub's Atom feed of the releases. */
export const RELEASES_FEED_URL = `${REPOSITORY_URL}/releases.atom`;

/** The footer's "How sync works": the design's "How the copy stays fresh". */
export const SYNC_URL = `${REPOSITORY_URL}/blob/main/docs/design/githq/README.md#how-the-copy-stays-fresh`;

/** The footer's "API limits": the decision on how the copy learns about changes without spending the limit (D7). */
export const API_LIMITS_URL = `${REPOSITORY_URL}/blob/main/docs/design/githq/DECISIONS.md#d7`;

/**
 * The docs (`packages/docs`), a site of their own the Worker serves beside the app: always a full page load — a plain
 * `<a href>`, never the app's router, which would take `/docs/` for a route of its own.
 */
export const DOCS_PATH = '/docs/';

/**
 * Where the app opens the docs (`Browser.openInNewTab`): `/docs/` on the web; githq.dev's in the desktop app, which has
 * no docs of its own, so that its window leaves them to the system browser (`desktop/externalLinks.ts`).
 */
export const DOCS_URL = __DESKTOP__ ? `https://githq.dev${DOCS_PATH}` : DOCS_PATH;

/** The ids of the landing page's sections the navigation and the footer link to (`#features`). */
export const LandingSectionId = {
    features: 'features',
    compare: 'compare',
    keyboard: 'keyboard',
    howItWorks: 'how-it-works',
    openSource: 'open-source',
} as const;
