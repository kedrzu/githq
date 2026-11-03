import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';

import type { MergeRules } from './getMergeMethods.js';

/**
 * Whether the base branch's rules allow the method: every ruleset allows it, and it is no merge commit where linear
 * history is required. The repository's own settings are not part of it.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function allowsMergeMethod(rules: MergeRules, method: PullRequestMergeMethod): boolean {
    if (rules.allowedMergeMethods && !rules.allowedMergeMethods.includes(method)) {
        return false;
    }

    return !(method === 'MERGE' && rules.requiresLinearHistory);
}
