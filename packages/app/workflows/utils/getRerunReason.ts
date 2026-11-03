import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';

import { toEditFailureReason } from '@/edits/toEditFailureReason.js';
import { getRefusalPause } from '@/sync/getRefusalPause.js';

/** Why a run's failed jobs were not re-run (actions W4l). */
export type WorkflowRerunReason =
    /** GitHub says the user's role may not. */
    | { readonly kind: 'noPermission' }
    /** GitHub re-runs a run for about a month after it ran. */
    | { readonly kind: 'tooOld' }
    /** Someone re-ran it since it was read. */
    | { readonly kind: 'alreadyRunning' }
    /** The organisation has not approved githq (G5). */
    | { readonly kind: 'organizationRestricted'; readonly organization: string }
    /** Any other refusal, in GitHub's own words. */
    | { readonly kind: 'refused'; readonly message: string }
    /** No answer: the request may or may not have got there. */
    | { readonly kind: 'unreachable' }
    /** GitHub failed on its side, which is not a refusal. */
    | { readonly kind: 'serverError'; readonly status: number }
    /** The allowance is used up until `until` (epoch ms). */
    | { readonly kind: 'allowance'; readonly until: number };

/** What {@link getRerunReason} tells a failure by. */
export interface GetRerunReasonParams {
    /** What the request failed with. */
    readonly error: unknown;
    /** The core allowance as last reported. */
    readonly limit: GitHubRateLimit | null;
    /** Epoch ms. */
    readonly now: number;
}

/**
 * Why GitHub did not re-run a run's failed jobs. GitHub tells its refusals apart by their words only, all with a 403:
 * "This workflow is already running", "Unable to retry this workflow run because it was created over a month ago".
 * Words it does not use for these are quoted.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRerunReason({ error, limit, now }: GetRerunReasonParams): WorkflowRerunReason {
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

    const message = error.githubMessage ?? error.message;
    if (/already running/iu.test(message)) {
        return { kind: 'alreadyRunning' };
    }

    if (/\bmonth\b/iu.test(message)) {
        return { kind: 'tooOld' };
    }

    if (/admin rights|not accessible|permission/iu.test(message)) {
        return { kind: 'noPermission' };
    }

    return { kind: 'refused', message };
}
