import type { PullRequestMergeMethod, PullRequestMergeOptionsQuery } from '@githq/github/generated.gen.js';
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { toPullRequestStatus } from '@/store/toItem.js';
import { toItemCheck } from '@/store/toItemCheck.js';
import { isPresent } from '@/utils/isPresent.js';

import type { MergeCheck, MergeOptions } from './MergeTypes.js';

/** The node `PullRequestMergeOptions` answers: a pull request, `{}` for another type, `null` when gone. */
export type MergeOptionsNode = PullRequestMergeOptionsQuery['node'];

type PullRequestNode = Exclude<NonNullable<MergeOptionsNode>, Record<PropertyKey, never>>;
type BaseRef = NonNullable<PullRequestNode['baseRef']>;
type CheckNode = NonNullable<
    NonNullable<NonNullable<PullRequestNode['statusCheckRollup']>['contextPage']['nodes']>[number]
>;

/**
 * What the merge panel decides from, as `PullRequestMergeOptions` read it; `null` when the node is no pull
 * request (gone, or no longer visible to the user).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toMergeOptions(node: MergeOptionsNode): MergeOptions | null {
    if (!isPresent(node)) {
        return null;
    }

    return {
        status: toPullRequestStatus(node),
        baseRefName: node.baseRefName,
        proposedTexts: {
            MERGE: { title: node.mergeHeadline, body: node.mergeBody },
            SQUASH: { title: node.squashHeadline, body: node.squashBody },
        },
        allowedMergeMethods: toAllowedMergeMethods(node.baseRef),
        requiresLinearHistory: toRequiresLinearHistory(node.baseRef),
        viewerCanMergeAsAdmin: node.viewerCanMergeAsAdmin,
        viewerCanEnableAutoMerge: node.viewerCanEnableAutoMerge,
        isMergeQueueEnabled: node.isMergeQueueEnabled,
        checks: mapNotNull(node.statusCheckRollup?.contextPage.nodes ?? [], check => check && toMergeCheck(check)),
        checkCount: node.statusCheckRollup?.contextPage.totalCount ?? 0,
    };
}

/** A method is allowed only when every pull request rule allows it; a rule naming no methods restricts none. */
function toAllowedMergeMethods(baseRef: BaseRef | null): PullRequestMergeMethod[] | null {
    let allowed: PullRequestMergeMethod[] | null = null;
    for (const rule of baseRef?.rules?.nodes ?? []) {
        if (rule?.type !== 'PULL_REQUEST' || !rule.parameters || !('allowedMergeMethods' in rule.parameters)) {
            continue;
        }

        const methods = rule.parameters.allowedMergeMethods;
        if (methods === null) {
            continue;
        }

        allowed = allowed === null ? [...methods] : allowed.filter(method => methods.includes(method));
    }

    return allowed;
}

function toRequiresLinearHistory(baseRef: BaseRef | null) {
    const byRuleset = (baseRef?.rules?.nodes ?? []).some(rule => rule?.type === 'REQUIRED_LINEAR_HISTORY');
    return byRuleset || baseRef?.branchProtectionRule?.requiresLinearHistory === true;
}

function toMergeCheck(check: CheckNode): MergeCheck {
    const base = { ...toItemCheck(check), isRequired: check.isRequired };
    switch (check.__typename) {
        case 'CheckRun':
            return {
                ...base,
                appSlug: check.checkSuite.app?.slug ?? null,
                workflowRunId: check.checkSuite.workflowRun?.databaseId ?? null,
            };
        case 'StatusContext':
            return { ...base, appSlug: null, workflowRunId: null };
        default:
            return assertNever(check);
    }
}
