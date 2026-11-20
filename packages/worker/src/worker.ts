import {
    OAUTH_APPROVAL_PATH,
    OAUTH_AUTHORIZE_PATH,
    OAUTH_REFRESH_PATH,
    OAUTH_REVOKE_PATH,
    OAUTH_TOKEN_PATH,
} from '@githq/github/oauth.js';

import { authorize, exchangeToken, openApproval, refreshAccessToken, revokeToken } from './githubOAuth.js';
import { isDocsPath, serveDocs } from './docs.js';
import { DOWNLOAD_PREFIX, serveDownload } from './download.js';
import { LANDING_PATH, serveHome, serveLanding } from './home.js';
import { isMediaPath, serveMedia } from './media.js';
import { getWorkerContainer } from './workerContainer.js';
import type { WorkerEnv } from './WorkerEnv.js';

/**
 * The githq Worker (`wrangler.jsonc`). Cloudflare serves the SPA's files itself and runs the Worker only for
 * `/api/*`, `/`, `/_landing`, `/download/*`, `/docs/*` but `/docs/assets/*` and `/landing/*.mp4`
 * (`assets.run_worker_first`). `/landing/*.mp4` are the landing page's videos, in byte ranges (`media.ts`). `/` and
 * `/_landing` are the choice between the prerendered landing page and the app (`home.ts`); `/download/*` are the fixed
 * links to the desktop installers of the latest release (`download.ts`); `/docs/*` is the documentation site, whose
 * unknown addresses get its 404 page instead of the app (`docs.ts`,
 * `docs/decisions/docs-site-under-githq-dev-docs.md`); `/api/*` is GitHub's OAuth (`githubOAuth.ts`, D1):
 * the code exchange, the refresh of an expired token, the revocation of a token on signing out, and the way to GitHub's page of the OAuth App. It is stateless: it stores nothing and keeps
 * no task data. Any other path that reaches it gets a JSON 404 — never the SPA's `index.html`, which a client calling the API would misread as a success.
 */
export default {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
        const { pathname } = new URL(request.url);
        if (pathname.startsWith(DOWNLOAD_PREFIX)) {
            return await serveDownload(request, env);
        }
        if (isDocsPath(pathname)) {
            return await serveDocs(request, env);
        }
        if (isMediaPath(pathname)) {
            return await serveMedia(request, env);
        }
        switch (pathname) {
            case '/':
                return await serveHome(request, env);
            case LANDING_PATH:
                return await serveLanding(request, env);
            case OAUTH_AUTHORIZE_PATH:
                return authorize(request, env, await getWorkerContainer(env));
            case OAUTH_TOKEN_PATH:
                return await exchangeToken(request, env, await getWorkerContainer(env));
            case OAUTH_REFRESH_PATH:
                return await refreshAccessToken(request, env, await getWorkerContainer(env));
            case OAUTH_REVOKE_PATH:
                return await revokeToken(request, env, await getWorkerContainer(env));
            case OAUTH_APPROVAL_PATH:
                return openApproval(request, env);
            default:
                return Response.json({ error: 'not_found' }, { status: 404 });
        }
    },
};
