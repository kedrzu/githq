import type { PullRequestCheckFieldsFragment } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { classifyCheckRun, classifyStatus } from './classifyChecks.js';
import type { ItemCheck } from './ItemDetailTypes.js';

/**
 * A check of a pull request's head commit as the opened item lists it — from its details or from what the merge
 * panel reads.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function toItemCheck(context: PullRequestCheckFieldsFragment): ItemCheck {
    switch (context.__typename) {
        case 'CheckRun':
            return {
                id: context.id,
                kind: 'checkRun',
                name: context.name,
                workflow: context.checkSuite.workflowRun?.workflow.name ?? null,
                // A run that has not completed is pending; a completed one is told by its conclusion.
                state:
                    context.status !== 'COMPLETED' || context.conclusion === null
                        ? 'pending'
                        : classifyCheckRun(context.conclusion),
                url: context.detailsUrl,
                startedAt: context.startedAt,
                completedAt: context.completedAt,
            };
        case 'StatusContext':
            return {
                id: context.id,
                kind: 'status',
                name: context.context,
                workflow: null,
                state: classifyStatus(context.state),
                url: context.targetUrl,
                startedAt: context.createdAt,
                completedAt: null,
            };
        default:
            return assertNever(context);
    }
}
