import type { BoundCommand, CommandPlace } from './CommandTypes.js';
import { COMMAND_SECTIONS, PLACES_TOGETHER } from './CommandTypes.js';

/**
 * The commands from the one that takes a shared key to the one that yields it — the registry runs the first that
 * matches and can run, and the help sheet lists a key only beside it. What has the keyboard decides (commands D13):
 * any screen place before `app`, the keeper of a {@link PLACES_TOGETHER} pair before the other; then the section
 * ({@link COMMAND_SECTIONS}). Stable: of equals, the one registered first.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function orderByKeyPrecedence(commands: readonly BoundCommand[]): BoundCommand[] {
    return commands.toSorted(
        (a, b) =>
            getPlaceRank(a.place) - getPlaceRank(b.place) ||
            COMMAND_SECTIONS.indexOf(a.section) - COMMAND_SECTIONS.indexOf(b.section),
    );
}

/** How many places keep the keyboard over it, one after another; `app` after them all. */
function getPlaceRank(place: CommandPlace): number {
    if (place === 'app') {
        return PLACES_TOGETHER.length + 1;
    }

    let rank = 0;
    for (const [keeper, other] of PLACES_TOGETHER) {
        if (other === place) {
            rank = Math.max(rank, getPlaceRank(keeper) + 1);
        }
    }

    return rank;
}
