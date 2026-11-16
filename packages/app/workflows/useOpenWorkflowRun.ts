import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useRoute, useRouter } from 'vue-router';

import type { ItemArrangement } from '@/item/itemRoutes.js';
import { getWorkflowRunPath } from '@/tracking/trackingRoutes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import { WorkflowRunRoutes } from './workflowRunRoutes.js';

/** A run to open and where. */
export interface OpenWorkflowRunParams {
    /** `owner/name` of the run's repository. */
    readonly nameWithOwner: string;
    readonly run: GitHubWorkflowRun;
    /** In the panel over the screen's list, or on its page. */
    readonly where: ItemArrangement;
}

/**
 * Opening a workflow's run when it is pressed: in the panel over the screen's list — in place of what is open there —,
 * or on its page in githq; both pushed, so Back (and Esc in the panel) returns to where it was opened.
 * @util
 */
export function useOpenWorkflowRun() {
    const route = useRoute();
    const router = useRouter();

    return openWorkflowRun;

    function openWorkflowRun(params: OpenWorkflowRunParams) {
        const { nameWithOwner, run, where } = params;
        switch (where) {
            case 'panel':
                void router.push({
                    path: route.path,
                    query: WorkflowRunRoutes.getQuery(route.query, {
                        ...parseRepositoryName(nameWithOwner),
                        runId: run.id,
                        jobId: null,
                    }),
                });
                return;
            case 'page':
                void router.push(getWorkflowRunPath({ nameWithOwner, runId: run.id }));
                return;
            default:
                assertNever(where);
        }
    }
}
