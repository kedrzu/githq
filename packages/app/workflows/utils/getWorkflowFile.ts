import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';

/** What precedes a workflow file's segment in its path. */
const WORKFLOWS_DIRECTORY = '.github/workflows/';
/** What precedes a workflow's segment in GitHub's address of it. */
const WORKFLOWS_URL_SEGMENT = '/actions/workflows/';

/**
 * A workflow's segment in GitHub's address of it (`WorkflowReference.file`): its path after `.github/workflows/`
 * (`deploy.yml`), or for one GitHub generates, the segment its `htmlUrl` has after `/actions/workflows/` (`pages`).
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getWorkflowFile(workflow: GitHubWorkflow): string {
    if (workflow.path.startsWith(WORKFLOWS_DIRECTORY)) {
        return workflow.path.slice(WORKFLOWS_DIRECTORY.length);
    }

    const at = workflow.htmlUrl.indexOf(WORKFLOWS_URL_SEGMENT);
    return at === -1 ? workflow.path : workflow.htmlUrl.slice(at + WORKFLOWS_URL_SEGMENT.length);
}
