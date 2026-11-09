import { DOCS_PATH } from './landingLinks.js';

/**
 * Where the app opens the docs (`Browser.openInNewTab`): `/docs/` on the web; githq.dev's in the desktop app, which has
 * no docs of its own, so that its window leaves them to the system browser (`desktop/externalLinks.ts`). Apart from
 * `landingLinks.ts`, which the build's checks import outside the app (`scripts/checkAppSiteAssociation.ts`), where
 * `__DESKTOP__` is not defined.
 */
export const DOCS_URL = __DESKTOP__ ? `https://githq.dev${DOCS_PATH}` : DOCS_PATH;
