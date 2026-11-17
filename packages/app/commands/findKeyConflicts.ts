import type { CommandPlace } from './CommandTypes.js';
import { PLACES_TOGETHER } from './CommandTypes.js';
import type { AnyAppCommand } from './defineAppCommand.js';
import { keyOf } from './keyOf.js';

/** Two definitions that can be active at once on one key: one of them would never run. */
export interface KeyConflict {
    /** As the first one writes it. */
    readonly key: string;
    readonly first: AnyAppCommand;
    readonly second: AnyAppCommand;
}

/**
 * The pairs of definitions whose keys (`keyOf`, other keys, a family's numbers) are one and whose places can be active
 * together ({@link placesCollide}) — found from the definitions alone, with no screen shown (commands D3). A screen
 * taking an app-wide key is not one, nor two fixed definitions (D13): nobody rebinds them, and their defaults are made
 * together, a `when` deciding which runs (Escape stepping back one layer at a time, the board's ←/→ and the list's).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findKeyConflicts(definitions: readonly AnyAppCommand[]): KeyConflict[] {
    const conflicts: KeyConflict[] = [];
    for (const [index, first] of definitions.entries()) {
        const keys = getKeys(first);
        for (const second of definitions.slice(index + 1)) {
            if ((!first.configurable && !second.configurable) || !placesCollide(first.places, second.places)) {
                continue;
            }

            const others = new Set(getKeys(second).map(normalizeKey));
            for (const key of keys) {
                if (others.has(normalizeKey(key))) {
                    conflicts.push({ key, first, second });
                }
            }
        }
    }

    return conflicts;
}

/**
 * Whether commands offered in these places can be active at once: they share a place, or two of their places are on
 * screen together ({@link PLACES_TOGETHER}). `app` meets only `app`: a screen's key over an app-wide one takes it there.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function placesCollide(a: readonly CommandPlace[], b: readonly CommandPlace[]): boolean {
    return a.some(first =>
        b.some(
            second =>
                first === second ||
                PLACES_TOGETHER.some(
                    ([keeper, other]) =>
                        (keeper === first && other === second) || (keeper === second && other === first),
                ),
        ),
    );
}

function getKeys(definition: AnyAppCommand): string[] {
    if (definition.kind === 'family') {
        const keys: string[] = [];
        for (let number = definition.numbers.first; number <= definition.numbers.last; number++) {
            keys.push(`${number}`);
        }

        return keys;
    }

    const key = keyOf(definition);
    return [...(key === undefined ? [] : [key]), ...(definition.otherKeys ?? [])];
}

/** `o` and `O` are one key: a letter's case is its Shift, which the notation writes out. */
function normalizeKey(key: string) {
    return key.toUpperCase();
}
