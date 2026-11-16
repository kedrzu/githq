import { defineOpenedItemKind } from '@/item/defineOpenedItemKind.js';
import { getWorkflowRunPath } from '@/tracking/trackingRoutes.js';
import type { RepositoryName } from '@/utils/parseRepositoryName.js';

/** A workflow's run as an address names it: its repository, its id and the job selected in it, if any. */
export interface WorkflowRunReference extends RepositoryName {
    readonly runId: number;
    readonly jobId: number | null;
}

/** What separates the owner, the name, the run and the job in the pane's `run` parameter. */
const RUN_SEPARATOR = '|';

/** An id of a run or a job as an address writes it: a positive integer. */
const ID_PATTERN = /^[1-9]\d*$/u;

/**
 * A workflow's run opened as an item: on its page, GitHub's address of the run or of its job
 * (`/owner/name/actions/runs/123/job/456`), or in the panel beside the repository's Workflows section
 * (`?pane=run&run=owner|name|123|456`), as GitHub's project pane writes an issue. Its key leaves the job out: moving
 * between the jobs stays on the same run.
 */
export const WorkflowRunRoutes = defineOpenedItemKind<WorkflowRunReference>({
    kind: 'run',
    formatPaneValue(reference) {
        const parts = [reference.owner, reference.name, reference.runId];
        return (reference.jobId === null ? parts : [...parts, reference.jobId]).join(RUN_SEPARATOR);
    },
    parsePaneValue(value) {
        const [owner, name, run, job, ...rest] = value.split(RUN_SEPARATOR);
        return rest.length === 0 ? toReference(owner, name, run, job) : null;
    },
    parsePageParams(params) {
        return toReference(params.owner, params.name, params.run, params.job);
    },
    getPagePath(reference) {
        return getWorkflowRunPath({
            nameWithOwner: `${reference.owner}/${reference.name}`,
            runId: reference.runId,
            jobId: reference.jobId ?? undefined,
        });
    },
    formatKey(reference) {
        return `${reference.owner}/${reference.name}/${reference.runId}`;
    },
});

function toReference(owner: unknown, name: unknown, run: unknown, job: unknown): WorkflowRunReference | null {
    if (typeof owner !== 'string' || typeof name !== 'string' || owner === '' || name === '' || !isId(run)) {
        return null;
    }

    if (job === undefined) {
        return { owner, name, runId: Number(run), jobId: null };
    }

    return isId(job) ? { owner, name, runId: Number(run), jobId: Number(job) } : null;
}

function isId(value: unknown): value is string {
    return typeof value === 'string' && ID_PATTERN.test(value);
}
