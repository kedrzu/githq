import type { BoundCommand } from './CommandTypes.js';

/**
 * The keys the registry runs an action by: its `key` and its other keys.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRunKeys(command: BoundCommand): readonly string[] {
    return [...(command.key === undefined ? [] : [command.key]), ...(command.otherKeys ?? [])];
}
