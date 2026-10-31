import { OAUTH_APPROVAL_PATH } from '@githq/github/oauth.js';

/**
 * The link to GitHub's page where the user requests an organisation's approval of githq (G5). Absolute, so a
 * button with it is a plain link out of the app: the Worker redirects it to GitHub.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getApprovalUrl(origin: string): string {
    return new URL(OAUTH_APPROVAL_PATH, origin).href;
}
