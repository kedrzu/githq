import type { AnchoredListViewport } from '../AnchoredList.vue';

/** How near the cursor may come to an edge of what shows before the diff scrolls (D44): a third of it. */
const SCROLL_OFF = 1 / 3;

export interface GetCursorScrollParams {
    /** The stop's top, from the viewport's top. */
    readonly top: number;
    /** The stop's bottom, from the viewport's top. */
    readonly bottom: number;
    readonly viewport: AnchoredListViewport;
    /** Which way the cursor moved. */
    readonly direction: 'down' | 'up';
}

/**
 * How far to scroll, down if positive, for the stop the cursor moved to to keep a third of what shows under the pinned
 * header from its edge (D44): its bottom from the bottom going down, its top from the pinned header going up; a stop
 * taller than the band between the two margins by its top. `0` inside the band, and never against the way it moved.
 * Never more than the list can scroll, so near the diff's ends the cursor reaches the edge.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getCursorScroll({ top, bottom, viewport, direction }: GetCursorScrollParams): number {
    const { height, covered, scrolled, remaining } = viewport;
    const margin = (height - covered) * SCROLL_OFF;
    const bandTop = covered + margin;
    const bandBottom = height - margin;
    const tall = bottom - top > bandBottom - bandTop;
    const distance =
        direction === 'down' ? Math.max(tall ? top - bandTop : bottom - bandBottom, 0) : Math.min(top - bandTop, 0);
    return Math.min(Math.max(distance, -scrolled), remaining);
}
