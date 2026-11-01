import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';

// Where the e2e tests find the app: the local build (`bun --cwd packages/app build:local`, with the development
// sign-in) served by the Worker in `wrangler dev` — the production shape, the static SPA and the Worker for
// `/api/*`, in the local Workers runtime. The desktop app's build (`build:desktop`) is served on another port by a
// plain static server (`src/desktop/serveDesktopApp.ts`): the desktop app has no Worker.
//
// Both ports are free ones the OS hands out, picked once per run, so `bun run dev` (8787 and 8788) and other e2e
// runs — several agents' worktrees at once — never take each other's. The Playwright runner picks them when it
// loads its config and passes them in the environment to everything it starts: the web servers and the test
// workers, which load this module again and read them instead of picking their own. Set them to pin the ports.

const PORT_ENV = 'GITHQ_E2E_PORT';
const DESKTOP_PORT_ENV = 'GITHQ_E2E_DESKTOP_PORT';

if (!process.env[PORT_ENV] || !process.env[DESKTOP_PORT_ENV]) {
    const [port, desktopPort] = await findFreePorts(2);
    process.env[PORT_ENV] ??= String(port);
    process.env[DESKTOP_PORT_ENV] ??= String(desktopPort);
}

/** The port the Worker serves the app on during the tests. */
export const E2E_PORT = Number(process.env[PORT_ENV]);

/** The app's address in the tests (`baseURL`). */
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** The dummy OAuth App the Worker runs with in the tests (`worker.vars`), and the desktop build is built with. */
export const E2E_CLIENT_ID = 'e2e-client';

/** The port the desktop app's build is served on during the tests. */
export const E2E_DESKTOP_PORT = Number(process.env[DESKTOP_PORT_ENV]);

/** The desktop app's address in the tests (the `desktop` project's `baseURL`). */
export const E2E_DESKTOP_BASE_URL = `http://localhost:${E2E_DESKTOP_PORT}`;

/** The Playwright project of the desktop app's tests (`src/desktop/`). */
export const DESKTOP_PROJECT = 'desktop';

/** Distinct ports free on `localhost`: all held open at once, so the OS cannot hand out one twice. */
async function findFreePorts(count: number) {
    const servers = await Promise.all(
        Array.from({ length: count }, async () => {
            const server = createServer();
            await new Promise<void>((resolve, reject) => {
                server.once('error', reject);
                server.listen(0, 'localhost', resolve);
            });
            return server;
        }),
    );
    const ports = servers.map(server => (server.address() as AddressInfo).port);
    await Promise.all(
        servers.map(
            server =>
                new Promise<void>(resolve => {
                    server.close(() => resolve());
                }),
        ),
    );
    return ports;
}
