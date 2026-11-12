import type { AnchoredListViewport } from '../AnchoredList.vue';

/**
 * Where the diff is being read, as a distance from its viewport's top (D42, D44): a third of the way down what shows
 * under the pinned header. It is never drawn; it decides the current file, which way a gap's lines come and which gap
 * E opens.
 *
 * Near either end of the diff it slides, so that scrolling through passes it over every row, the first and the last
 * too: once the list can scroll less than the distance from the line to the viewport's bottom, the line moves down by
 * what is missing, reaching the bottom edge at the end; and while it has scrolled less than the distance from the top
 * to the line, the line sits that far down, at the top edge at the start. A list scrolling less than a viewport, where
 * the two would meet, moves the line from the top edge to the bottom one evenly; one that does not scroll keeps it
 * where it is.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getReadingLine({ height, covered, scrolled, remaining }: AnchoredListViewport): number {
    const line = covered + (height - covered) / 3;
    const scrollable = scrolled + remaining;
    if (scrollable === 0) {
        return line;
    }

    if (scrollable < height) {
        return (height * scrolled) / scrollable;
    }

    return Math.max(Math.min(line, scrolled), height - remaining);
}
