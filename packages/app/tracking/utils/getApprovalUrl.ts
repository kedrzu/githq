import { OAUTH_APPROVAL_PATH } from '@githq/github/oauth.js';

/**
 * The link to GitHub's page where the user requests an organisation's approval of githq (G5). Absolute, so a
 * button with it is a plain link out of the app: the Worker redirects it to GitHub. The desktop app has no Worker
 * and links to GitHub itself, with the client ID it was built with — without one, to the user's list of the apps
 * they authorised.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getApprovalUrl(origin: string): string {
    if (__DESKTOP__) {
        return __GITHUB_CLIENT_ID__ === null
            ? 'https://github.com/settings/applications'
            : `https://github.com/settings/connections/applications/${__GITHUB_CLIENT_ID__}`;
    }

    return new URL(OAUTH_APPROVAL_PATH, origin).href;
}
