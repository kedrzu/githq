/** githq's repository. */
export const GITHUB_URL = 'https://github.com/kedrzu/githq';

/** Where a page is edited on GitHub; VitePress puts the page's path (`getting-started/what-is-githq.md`) for `:path`. */
export const EDIT_URL_PATTERN = `${GITHUB_URL}/edit/main/packages/docs/src/:path`;

/** "Report a problem": a new issue in the repository. */
export const NEW_ISSUE_URL = `${GITHUB_URL}/issues/new`;

/** The history of the docs' pages on GitHub. */
export const DOCS_HISTORY_URL = `${GITHUB_URL}/commits/main/packages/docs/src`;

/** githq's releases: what changed in each version. */
export const RELEASES_URL = `${GITHUB_URL}/releases`;

/** githq's licence. */
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
