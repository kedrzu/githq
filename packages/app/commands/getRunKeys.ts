import type { Command } from './CommandTypes.js';

/**
 * The keys the registry runs an action by: its `key`, and its other keys once it is bound from a definition (an
 * unplaced action's other keys are its component's own, only listed).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getRunKeys(command: Command): readonly string[] {
    const keys = command.key === undefined ? [] : [command.key];
    return command.place === undefined ? keys : [...keys, ...(command.otherKeys ?? [])];
}
