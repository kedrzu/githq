import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { useRouter } from 'vue-router';

import { getWorkflowRunPath } from '@/tracking/trackingRoutes.js';

/**
 * Opening a workflow's run when it is pressed: on its page in githq, Back returning to where it was opened.
 * @util
 */
export function useOpenWorkflowRun() {
    const router = useRouter();

    return openWorkflowRun;

    function openWorkflowRun(nameWithOwner: string, run: GitHubWorkflowRun) {
        void router.push(getWorkflowRunPath(nameWithOwner, run.id));
    }
}
