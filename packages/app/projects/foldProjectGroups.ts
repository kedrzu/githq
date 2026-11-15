import { foldStacks } from '@/lists/foldStacks.js';
import type { ListGroup } from '@/lists/ListTypes.js';
import { withStackMembers } from '@/lists/withStackMembers.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import type { PullRequestStack } from '@/store/stacks/groupStacks.js';

import { getProjectEntryId } from './buildProjectList.js';
import type { ProjectEntry } from './ProjectTypes.js';

/** What {@link foldProjectGroups} folds. */
export interface FoldProjectGroupsParams {
    /** The entries the view's filter keeps (`selectProjectEntries`). */
    readonly matched: readonly ProjectEntry[];
    /** The project's entries not archived: where a matched stack's other pull requests are found. */
    readonly entries: readonly ProjectEntry[];
    /** The view's groups of the entries given, rows sorted (`buildProjectList`). */
    readonly build: (shown: readonly ProjectEntry[]) => ListGroup<ProjectEntry>[];
    /** The stacks of the local copy, by id (`groupStacks`): the project need not hold all their pull requests. */
    readonly stacks: ReadonlyMap<string, PullRequestStack>;
    readonly describe: (stack: PullRequestStack) => StackDescription;
}

/**
 * A project view's groups as shown, from the entries its filter keeps: a stack any of whose pull requests matches shows
 * them all, in the groups the filter alone gives (D3, SP25), and a stack's pull requests in a group share an entry
 * (`foldStacks`, D3) — the same whether the view is shown or only counted, so its count does not change as it is
 * opened.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function foldProjectGroups(params: FoldProjectGroupsParams): ListGroup<ProjectEntry>[] {
    const { matched, build } = params;
    const shown = withStackMembers({ matched, all: params.entries, getPullRequest });
    const built = build(matched);
    const keys = new Set(built.map(group => group.key));
    return foldStacks({
        groups: shown === matched ? built : build(shown).filter(group => keys.has(group.key)),
        getPullRequest,
        stacks: params.stacks,
        describe: params.describe,
        matched: shown === matched ? null : new Set(matched.map(getProjectEntryId)),
    });
}

function getPullRequest(entry: ProjectEntry) {
    return entry.content?.kind === 'pullRequest' ? entry.content : null;
}
