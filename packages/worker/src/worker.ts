import { OAUTH_APPROVAL_PATH, OAUTH_AUTHORIZE_PATH, OAUTH_TOKEN_PATH } from '@githq/github/oauth.js';

import { authorize, exchangeToken, openApproval } from './githubOAuth.js';
import { LANDING_PATH, serveHome, serveLanding } from './home.js';
import type { WorkerEnv } from './WorkerEnv.js';

/**
 * The githq Worker (`wrangler.jsonc`). Cloudflare serves the SPA's files itself and runs the Worker only for
 * `/api/*`, `/` and `/_landing` (`assets.run_worker_first`). `/` and `/_landing` are the choice between the
 * prerendered landing page and the app (`home.ts`); `/api/*` is GitHub's OAuth (`githubOAuth.ts`, D1):
 * the code exchange, and the way to GitHub's page of the OAuth App. It is stateless: it stores nothing and keeps
 * no task data. Any other path that reaches it gets a JSON 404 — never the SPA's `index.html`, which a client calling the API would misread as a success.
 */
export default {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
        switch (new URL(request.url).pathname) {
            case '/':
                return await serveHome(request, env);
            case LANDING_PATH:
                return await serveLanding(request, env);
            case OAUTH_AUTHORIZE_PATH:
                return authorize(request, env);
            case OAUTH_TOKEN_PATH:
                return await exchangeToken(request, env);
            case OAUTH_APPROVAL_PATH:
                return openApproval(request, env);
            default:
                return Response.json({ error: 'not_found' }, { status: 404 });
        }
    },
};
