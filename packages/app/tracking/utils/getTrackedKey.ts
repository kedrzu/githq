import type { TrackedTarget } from '../TrackingTypes.js';

/**
 * The key a tracked repository or project is known by among both kinds — `repository:owner/name`, `project:<id>` —
 * as maps and stores of tracked things are keyed.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getTrackedKey(target: TrackedTarget): string {
    return target.kind === 'repository' ? `repository:${target.nameWithOwner}` : `project:${target.id}`;
}
