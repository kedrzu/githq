import { findDiffMatches } from './findDiffMatches.js';
import type { DiffMatches, FindLine } from './findDiffMatches.js';

/** A search, by its expression's parts: a `RegExp` isn't sent as one. */
export interface FindRequest {
    /** Which search this is: the answer carries it, so one a newer search superseded is told apart. */
    readonly sequence: number;
    readonly lines: readonly FindLine[];
    readonly source: string;
    readonly flags: string;
}

/** A search's matches. */
export interface FindResponse {
    readonly sequence: number;
    readonly matches: DiffMatches;
}

onmessage = ({ data }: MessageEvent<FindRequest>) => {
    const matches = findDiffMatches(data.lines, new RegExp(data.source, data.flags));
    const response: FindResponse = { sequence: data.sequence, matches };
    // Moved, not copied: the main thread gets the matches for nothing.
    const { lines, starts, ends, counted } = matches;
    postMessage(response, { transfer: [lines.buffer, starts.buffer, ends.buffer, counted.buffer] });
};
