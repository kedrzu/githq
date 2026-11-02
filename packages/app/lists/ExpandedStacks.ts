import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

/**
 * The stacks whose entries the user expanded (D10): in every list at once, for the session, in memory — an entry is
 * collapsed until expanded, and back to that after a restart.
 */
export type ExpandedStacks = Resolved<typeof ExpandedStacks>;
export const ExpandedStacks = defineService({
    name: 'ExpandedStacks',
    setup() {
        const idsRef = shallowRef<ReadonlySet<string>>(new Set());

        return { has, set };

        /** Whether the stack's entries are expanded; reactive. */
        function has(stackId: string): boolean {
            return idsRef.value.has(stackId);
        }

        function set(stackId: string, expanded: boolean) {
            if (has(stackId) === expanded) {
                return;
            }

            const next = new Set(idsRef.value);
            if (expanded) {
                next.add(stackId);
            } else {
                next.delete(stackId);
            }

            idsRef.value = next;
        }
    },
});
