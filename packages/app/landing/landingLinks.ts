/** The repository on GitHub: "Star on GitHub", the navigation's "kedrzu/githq" and every other way out to GitHub. */
export const REPOSITORY_URL = 'https://github.com/kedrzu/githq';

/** Why githq asks for what it does — the design's "What githq keeps in your browser", until a page of its own. */
export const WHY_URL = `${REPOSITORY_URL}/blob/main/docs/design/githq/README.md#what-githq-keeps-in-your-browser`;

/** The ids of the landing page's sections the navigation links to (`#features`). */
export const LandingSectionId = {
    features: 'features',
    keyboard: 'keyboard',
    howItWorks: 'how-it-works',
    openSource: 'open-source',
} as const;
