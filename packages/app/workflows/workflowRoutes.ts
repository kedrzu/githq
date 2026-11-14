import { defineOpenedItemKind } from '@/item/defineOpenedItemKind.js';
import type { RepositoryName } from '@/utils/parseRepositoryName.js';

/** A workflow as an address names it: its repository and its file. */
export interface WorkflowReference extends RepositoryName {
    /**
     * The workflow's segment in GitHub's address of it: its path after `.github/workflows/` (`deploy.yml`), or for a
     * workflow GitHub generates, the segment its `html_url` has after `/actions/workflows/` (`pages`).
     */
    readonly file: string;
}

/**
 * The route path of a tracked repository's workflow on a page of its own (actions D15), at GitHub's address of it. A
 * repository not tracked has it handed off to GitHub (`middleware/auth.global.ts`, actions D4).
 */
export const WORKFLOW_PAGE_PATH = '/:owner/:name/actions/workflows/:file(.+)';

/** What separates the owner, the name and the file in the pane's `workflow` parameter. */
const WORKFLOW_SEPARATOR = '|';

/**
 * A workflow opened as an item: on its page (`/owner/name/actions/workflows/deploy.yml`), or in the panel beside the
 * repository's Workflows section (`?pane=workflow&workflow=owner|name|deploy.yml`), as GitHub's project pane writes an
 * issue.
 */
export const WorkflowRoutes = defineOpenedItemKind<WorkflowReference>({
    kind: 'workflow',
    formatPaneValue(reference) {
        return [reference.owner, reference.name, reference.file].join(WORKFLOW_SEPARATOR);
    },
    parsePaneValue(value) {
        const [owner, name, ...file] = value.split(WORKFLOW_SEPARATOR);
        return toReference(owner, name, file.join(WORKFLOW_SEPARATOR));
    },
    parsePageParams(params) {
        return toReference(params.owner, params.name, params.file);
    },
    getPagePath(reference) {
        return `/${reference.owner}/${reference.name}/actions/workflows/${reference.file}`;
    },
    formatKey(reference) {
        return `${reference.owner}/${reference.name}/${reference.file}`;
    },
});

/**
 * The workflow a key names, as `WorkflowRoutes.formatKey` writes it (`owner/name/deploy.yml`) — what a list of
 * workflows steps through (`ItemNavigation.list`); `null` when it names none.
 * @__NO_SIDE_EFFECTS__
 */
export function parseWorkflowKey(key: string): WorkflowReference | null {
    const [owner, name, ...file] = key.split('/');
    return toReference(owner, name, file.join('/'));
}

function toReference(owner: unknown, name: unknown, file: unknown): WorkflowReference | null {
    return typeof owner === 'string' &&
        typeof name === 'string' &&
        typeof file === 'string' &&
        owner !== '' &&
        name !== '' &&
        file !== ''
        ? { owner, name, file }
        : null;
}
