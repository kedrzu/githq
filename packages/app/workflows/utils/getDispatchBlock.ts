import type { GitHubWorkflowFileParse } from '@githq/github/workflows/parseWorkflowFile.js';
import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';

import { getRepositoryDispatchBlock } from './getRepositoryDispatchBlock.js';

/**
 * Why a workflow can't be run by hand. `noAccess` and `archived` are the repository's, and "Run workflow" isn't offered
 * there at all; the others are the workflow's, and it is offered disabled, saying why (W48).
 */
export type WorkflowDispatchBlock =
    /** The user's role is below write, or not known. */
    | 'noAccess'
    | 'archived'
    /** GitHub generates it (Pages, Dependabot, CodeQL): no file of the repository's to run. */
    | 'generated'
    /** GitHub lists it as anything but active. */
    | 'disabled'
    /** Its file has no `workflow_dispatch` trigger. */
    | 'noDispatch'
    /** Its file is missing or not YAML. */
    | 'unreadable';

/** What {@link getDispatchBlock} decides by. */
export interface GetDispatchBlockParams {
    readonly workflow: GitHubWorkflow;
    /** GitHub generates it ({@link WorkflowState.generated}). */
    readonly generated: boolean;
    /** The repository as last read; `undefined` before that. */
    readonly metadata: Pick<RepositoryMetadata, 'isArchived' | 'viewerPermission'> | undefined;
    /** Its file at the ref it would run on; `null` while it is not read yet, which blocks nothing. */
    readonly parse: GitHubWorkflowFileParse | null;
}

/**
 * Why the user can't run a workflow by hand, or `null` when nothing says they can't (actions W37, W48): write access to
 * a repository that isn't archived, as for every edit, then a workflow of the repository's own, enabled, whose file has
 * `workflow_dispatch`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getDispatchBlock({
    workflow,
    generated,
    metadata,
    parse,
}: GetDispatchBlockParams): WorkflowDispatchBlock | null {
    const repositoryBlock = getRepositoryDispatchBlock(metadata);
    if (repositoryBlock !== null) {
        return repositoryBlock;
    }

    if (generated) {
        return 'generated';
    }

    if (workflow.state !== 'active') {
        return 'disabled';
    }

    switch (parse?.kind) {
        case undefined:
            return null;
        case 'parsed':
            return parse.file.dispatch ? null : 'noDispatch';
        case 'noTriggers':
            return 'noDispatch';
        case 'missing':
        case 'notYaml':
            return 'unreadable';
        default:
            return assertNever(parse);
    }
}
