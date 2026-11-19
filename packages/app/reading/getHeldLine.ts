import type { ReadingBand, ReadingSegment } from './ReadingCursor.js';

export interface GetHeldLineParams {
    /** The cursor's segment as the key goes down. */
    readonly segment: ReadingSegment;
    readonly band: ReadingBand;
    readonly direction: 'down' | 'up';
}

/**
 * Where the reading line a held ↓ ↑ carries starts, from the content's top (`followHeld`): at the cursor's segment's
 * start going down, its end going up, so the cursor leaves it as soon as the line has passed it; kept inside the band,
 * so for a segment reaching past what shows the line starts at the band's edge, not somewhere out of sight.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getHeldLine({ segment, band, direction }: GetHeldLineParams): number {
    const line = direction === 'down' ? segment.start : segment.end;
    return Math.min(Math.max(line, band.top), band.bottom);
}
