import type { ListedItems } from './ListTypes.js';

/**
 * What a list hands over, with only the items `keep` lets through: a cursor's neighbour left out gives way to the next
 * step on that side.
 * @__NO_SIDE_EFFECTS__
 */
export function filterListedItems(listed: ListedItems, keep: (id: string) => boolean): ListedItems {
    const { all, steps, stepOf, around } = listed;
    return {
        all: all.filter(keep),
        steps: steps.filter(keep),
        stepOf,
        around: around && { previous: findKept(around.previous, -1), next: findKept(around.next, 1) },
    };

    function findKept(id: string | null, by: 1 | -1) {
        if (id === null) {
            return null;
        }

        let index = steps.indexOf(id);
        let current = steps[index];
        while (current !== undefined && !keep(current)) {
            index += by;
            current = steps[index];
        }

        return current ?? null;
    }
}
