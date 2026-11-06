import type { MyWorkGroupRows, MyWorkRow } from './buildMyWork.js';
import { groupMyWorkRows } from './groupMyWorkRows.js';

/** The rows of "my work" from one tracked repository, or from all the repositories the user doesn't track. */
export interface MyWorkRepositoryGroup {
    /** `owner/name` of a tracked repository; `null` for "Other repositories". */
    readonly repository: string | null;
    readonly rows: readonly MyWorkRow[];
}

/**
 * "My work" grouped by repository (D22): a group per tracked repository in `trackedRepositories`' order (the
 * sidebar's), then one of everything from repositories not tracked; groups without rows are left out. Inside a
 * group the rows keep the order of `groups` — reason by reason, each in its own order. A pull request or a stack
 * nested under the issue it closes (D12) stays under it, in the issue's group, and a stack's entry stays whole (all its
 * pull requests are of one repository), so every row and the counts stay those of `groups`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupMyWorkByRepository(
    groups: readonly MyWorkGroupRows[],
    trackedRepositories: readonly string[],
): MyWorkRepositoryGroup[] {
    const order = new Map(trackedRepositories.map((name, index) => [name, index]));
    return groupMyWorkRows<string | null>({
        groups,
        keyOf: row => (order.has(row.item.repository.nameWithOwner) ? row.item.repository.nameWithOwner : null),
        compare: (a, b) => indexOf(a) - indexOf(b),
    }).map(({ key, rows }) => ({ repository: key, rows }));

    function indexOf(repository: string | null) {
        return (repository === null ? undefined : order.get(repository)) ?? order.size;
    }
}
