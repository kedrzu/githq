import { assert } from '@nzyme/utils/assert.js';

import { findMatches, prepareMatchTexts } from '@/utils/findMatches.js';
import type { PreparedMatchTexts, TextMatch } from '@/utils/findMatches.js';

import { getFileName } from './getFileName.js';

/** A path typed text finds, with what to mark of it. */
export interface FoundFilePath {
    readonly path: string;
    /**
     * Which part of the path `ranges` mark: its file name, or its folder when the match lies there alone; `null` when
     * nothing is typed or the match spans both, which marks nothing.
     */
    readonly part: 'name' | 'folder' | null;
    /** The matched parts of that part, as offsets `[start, end, start, end…]`; `null` when unmarked. */
    readonly ranges: readonly number[] | null;
}

/** The texts of a list of paths, by each path's position in it. */
interface PreparedPaths {
    readonly names: PreparedMatchTexts<number>;
    readonly paths: PreparedMatchTexts<number>;
}

/**
 * What a match in the file name counts above the same match in the whole path: a file is known by its name, but a
 * folder typed as it is (`src/sync`, scoring 40 and up) still outranks letters scattered in a name (20 at most).
 */
const NAME_BONUS = 20;

/**
 * Rows `findMatches()` ranks before scattered letters: past this a query ranks only the first this many, as a long
 * list's options do (`filterOptions`), to stay inside a frame. A pull request lists up to 3000 files.
 */
const HIT_LIMIT = 1000;

/** The texts per paths array: readying 3000 paths on every keystroke is wasted work. */
const PREPARED_PATHS = new WeakMap<readonly string[], PreparedPaths>();

/**
 * The paths typed text finds, as in ⌘P of an editor: scattered letters too, the file name ahead of its folders, best
 * first and in list order among equals. Nothing typed lists every path as given. An array is read once: pass a new one
 * when the paths change.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findFilePaths(query: string, paths: readonly string[]): FoundFilePath[] {
    if (query.trim() === '') {
        return paths.map(path => ({ path, part: null, ranges: null }));
    }

    const prepared = preparePaths(paths);
    const options = { letters: true, hitLimit: HIT_LIMIT };
    const best = new Map<number, { score: number; found: FoundFilePath }>();
    for (const match of findMatches(query, prepared.paths, options)) {
        best.set(match.row, { score: match.score, found: toFoundInPath(getPath(paths, match), match.ranges) });
    }

    for (const match of findMatches(query, prepared.names, options)) {
        const score = match.score + NAME_BONUS;
        const inPath = best.get(match.row);
        if (inPath == null || score >= inPath.score) {
            best.set(match.row, { score, found: { path: getPath(paths, match), part: 'name', ranges: match.ranges } });
        }
    }

    return [...best.entries()]
        .toSorted(([a, foundA], [b, foundB]) => foundB.score - foundA.score || a - b)
        .map(([, { found }]) => found);
}

function preparePaths(paths: readonly string[]) {
    const kept = PREPARED_PATHS.get(paths);
    if (kept) {
        return kept;
    }

    const positions = [...paths.keys()];
    const prepared: PreparedPaths = {
        names: prepareMatchTexts(positions, position => [getFileName(paths[position] ?? '')]),
        paths: prepareMatchTexts(positions, position => [paths[position] ?? '']),
    };
    PREPARED_PATHS.set(paths, prepared);
    return prepared;
}

/** A match in the whole path, marked in the part holding all of it. */
function toFoundInPath(path: string, ranges: readonly number[] | null): FoundFilePath {
    const slash = path.lastIndexOf('/');
    if (ranges == null || ranges.length === 0) {
        return { path, part: null, ranges: null };
    }

    if (ranges.every(offset => offset <= slash)) {
        return { path, part: 'folder', ranges };
    }

    if (ranges.every(offset => offset > slash)) {
        return { path, part: 'name', ranges: ranges.map(offset => offset - slash - 1) };
    }

    return { path, part: null, ranges: null };
}

function getPath(paths: readonly string[], match: TextMatch<number>) {
    const path = paths[match.row];
    assert(path !== undefined);
    return path;
}
