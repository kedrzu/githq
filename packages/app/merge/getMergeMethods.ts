import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';

import type { MergeOptions } from './MergeTypes.js';

/** The repository's settings {@link getMergeMethods} starts from. */
export type MergeSettings = Pick<
    RepositoryMetadata,
    'mergeCommitAllowed' | 'squashMergeAllowed' | 'rebaseMergeAllowed' | 'viewerDefaultMergeMethod'
>;

/** The base branch's rules {@link getMergeMethods} narrows the settings by, as the merge panel's read brings them. */
export type MergeRules = Pick<MergeOptions, 'allowedMergeMethods' | 'requiresLinearHistory'>;

/** The merge methods offered for a pull request. */
export interface MergeMethods {
    /** In the order the panel lists them: squash, merge commit, rebase. May be empty. */
    readonly methods: readonly PullRequestMergeMethod[];
    /** The method the panel starts on; `null` when none is offered. */
    readonly defaultMethod: PullRequestMergeMethod | null;
}

/** The order the panel lists the methods in (PM5). */
const ORDER: readonly PullRequestMergeMethod[] = ['SQUASH', 'MERGE', 'REBASE'];

/**
 * The merge methods offered (merging D2): those the repository's settings allow, narrowed by the base branch's
 * rulesets and without a merge commit where linear history is required. Before the panel's read arrives
 * (`rules` is `null`), the settings alone (D6): a method a ruleset forbids is then refused by GitHub. It starts on
 * the viewer's default method when that is offered, else on the first one.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getMergeMethods(settings: MergeSettings, rules: MergeRules | null): MergeMethods {
    const methods = ORDER.filter(method => {
        if (!isAllowedBySettings(settings, method)) {
            return false;
        }

        if (rules?.allowedMergeMethods && !rules.allowedMergeMethods.includes(method)) {
            return false;
        }

        return !(method === 'MERGE' && rules?.requiresLinearHistory);
    });

    const defaultMethod = methods.includes(settings.viewerDefaultMergeMethod)
        ? settings.viewerDefaultMergeMethod
        : (methods[0] ?? null);
    return { methods, defaultMethod };
}

function isAllowedBySettings(settings: MergeSettings, method: PullRequestMergeMethod) {
    switch (method) {
        case 'MERGE':
            return settings.mergeCommitAllowed;
        case 'SQUASH':
            return settings.squashMergeAllowed;
        case 'REBASE':
            return settings.rebaseMergeAllowed;
        default:
            return assertNever(method);
    }
}
