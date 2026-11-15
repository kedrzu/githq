import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';

import { toEditFailureReason } from '@/edits/toEditFailureReason.js';
import { getRefusalPause } from '@/sync/getRefusalPause.js';

/** Why a workflow was not run (W37). */
export type WorkflowDispatchReason =
    /** GitHub says the user's role may not (403). */
    | { readonly kind: 'noPermission' }
    /** GitHub has no such workflow or ref, or won't show it (404). */
    | { readonly kind: 'notFound' }
    /** The organisation has not approved githq (G5). */
    | { readonly kind: 'organizationRestricted'; readonly organization: string }
    /** Any other refusal — the ref has no `workflow_dispatch` trigger, an input it doesn't take — in GitHub's own words. */
    | { readonly kind: 'refused'; readonly message: string }
    /** No answer: the request may or may not have got there. */
    | { readonly kind: 'unreachable' }
    /** GitHub failed on its side, which is not a refusal. */
    | { readonly kind: 'serverError'; readonly status: number }
    /** The allowance is used up until `until` (epoch ms). */
    | { readonly kind: 'allowance'; readonly until: number };

/** What {@link getDispatchReason} tells a failure by. */
export interface GetDispatchReasonParams {
    /** What the request failed with. */
    readonly error: unknown;
    /** The core allowance as last reported. */
    readonly limit: GitHubRateLimit | null;
    /** Epoch ms. */
    readonly now: number;
}

/**
 * Why GitHub did not run a workflow. It answers 422 for what it won't run as asked — a ref whose file has no
 * `workflow_dispatch`, inputs the file doesn't declare — and says which in its message, quoted.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getDispatchReason({ error, limit, now }: GetDispatchReasonParams): WorkflowDispatchReason {
    if (!(error instanceof GitHubApiError)) {
        return { kind: 'unreachable' };
    }

    const pause = getRefusalPause({ error, limits: [limit], now });
    if (pause) {
        return { kind: 'allowance', until: pause.until };
    }

    if (error.status >= 500) {
        return { kind: 'serverError', status: error.status };
    }

    const reason = toEditFailureReason(error);
    if (reason.kind === 'organizationRestricted') {
        return reason;
    }

    switch (error.status) {
        case 403:
            return { kind: 'noPermission' };
        case 404:
            return { kind: 'notFound' };
        default:
            return { kind: 'refused', message: error.githubMessage ?? error.message };
    }
}
