// Where the e2e tests find the app: the local build (`bun --cwd packages/app build:local`, with the development
// sign-in) served by the Worker in `wrangler dev` — the production shape, the static SPA and the Worker for
// `/api/*`, in the local Workers runtime. A port of its own, so `bun run dev` (8787 and 8788) can keep running
// next to the tests. The desktop app's build (`build:desktop`) is served on another port by a plain static server
// (`src/desktop/serveDesktopApp.ts`): the desktop app has no Worker.

/** The port the Worker serves the app on during the tests. */
export const E2E_PORT = 8790;

/** The app's address in the tests (`baseURL`). */
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** The dummy OAuth App the Worker runs with in the tests (`worker.vars`), and the desktop build is built with. */
export const E2E_CLIENT_ID = 'e2e-client';

/** The port the desktop app's build is served on during the tests. */
export const E2E_DESKTOP_PORT = 8791;

/** The desktop app's address in the tests (the `desktop` project's `baseURL`). */
export const E2E_DESKTOP_BASE_URL = `http://localhost:${E2E_DESKTOP_PORT}`;

/** The Playwright project of the desktop app's tests (`src/desktop/`). */
export const DESKTOP_PROJECT = 'desktop';
