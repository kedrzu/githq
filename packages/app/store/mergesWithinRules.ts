import type { MergeStateStatus } from '@githq/github/generated.gen.js';

/**
 * Whether GitHub merges in this state without anyone bypassing a rule: `UNSTABLE` only has checks that aren't required
 * failing. A state GitHub adds later reads as not: this decides whether a merge is let through, so it fails closed
 * rather than throw.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function mergesWithinRules(status: MergeStateStatus): boolean {
    switch (status) {
        case 'CLEAN':
        case 'HAS_HOOKS':
        case 'UNSTABLE':
            return true;
        case 'BEHIND':
        case 'BLOCKED':
        case 'DIRTY':
        case 'DRAFT':
        case 'UNKNOWN':
            return false;
        default:
            status satisfies never;
            return false;
    }
}
