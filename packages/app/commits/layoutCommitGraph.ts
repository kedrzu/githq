import type { KeptCommit } from './CommitTypes.js';

/**
 * The commit graph laid out in lanes, one row per commit, each row self-contained so a fixed-height row can draw its
 * own slice of the graph.
 *
 * How to render a row of height `h`, with lane `n` at `x(n) = n * laneWidth + laneWidth / 2`:
 * - the dot at `(x(column), h / 2)`;
 * - every line from its start to its end (`CommitGraphLine`): straight when its lane is the row's `column` or it is a
 *   `full` line, otherwise a curve between the lane and the dot.
 *
 * Lanes are plain integers that never shift: a lane keeps its index from the row it starts in to the row it ends in.
 * To fold every lane from `n` on into one line at the graph's right edge (git-client D17), draw lane `min(lane, n)`
 * — a curve between two folded lanes then becomes a straight line on the folded one.
 */
export interface CommitGraphLayout {
    readonly rows: readonly CommitGraphRow[];
    /** How many lanes the whole graph needs: one more than the highest lane among any row's dot and lines. */
    readonly maxWidth: number;
}

/** One commit's row. */
export interface CommitGraphRow {
    readonly oid: string;
    /** The lane its dot sits on. */
    readonly column: number;
    /** It has more than one parent, loaded or not. */
    readonly isMerge: boolean;
    /** What to draw within the row, in lane coordinates. */
    readonly lines: readonly CommitGraphLine[];
}

/**
 * A line within one row. `top`: from the top of the row at `lane` to the dot — an edge from a child above (when
 * `lane` isn't the row's column, a lane merging into the commit and ending here). `bottom`: from the dot to the bottom
 * of the row at `lane` — an edge to one of its parents (when `lane` isn't the row's column, a merge's further parent).
 * `full`: from the top to the bottom of the row at `lane` — an edge passing by.
 *
 * A lane may carry two lines in one row: a `full` and a `bottom` (a merge's parent joins a lane already passing by,
 * waiting for the same commit), or a `top` and a `bottom` (a lane merging into the dot ends, and a further parent
 * starts in it). Each is drawn on its own.
 *
 * Lanes are continuous: the lanes with a `bottom` or `full` line in a row are exactly those with a `top` or `full`
 * line in the next one. A lane still open after the last row leads to a parent that isn't loaded — the history goes
 * on below.
 */
export interface CommitGraphLine {
    readonly half: CommitGraphLineHalf;
    readonly lane: number;
}

/** Which part of the row a `CommitGraphLine` spans. */
export type CommitGraphLineHalf = 'top' | 'bottom' | 'full';

/**
 * Lays commits ordered by `orderCommits` out in lanes, top-down. Each lane waits for one commit: a commit takes the
 * leftmost lane waiting for it (a tip takes the first free lane), the other lanes waiting for it merge into its dot
 * and end, its first parent continues in its lane, and each further parent joins a lane already waiting for it or
 * takes the first free one. A freed lane is reused by the next lane that starts, so the graph doesn't widen forever,
 * and no other lane moves when one ends.
 *
 * Expects every loaded parent below its children; a parent above or not loaded keeps its lane open to the last row.
 * @__NO_SIDE_EFFECTS__
 */
export function layoutCommitGraph(ordered: readonly KeptCommit[]): CommitGraphLayout {
    /** The oid each lane waits for, `null` for a free lane. */
    const lanes: (string | null)[] = [];
    const rows: CommitGraphRow[] = [];
    let maxWidth = 0;

    for (const commit of ordered) {
        const lines: CommitGraphLine[] = [];
        let column = -1;

        for (const [lane, oid] of lanes.entries()) {
            if (oid === null) {
                continue;
            }
            if (oid !== commit.oid) {
                lines.push({ half: 'full', lane });
                continue;
            }
            lines.push({ half: 'top', lane });
            lanes[lane] = null;
            if (column === -1) {
                column = lane;
            }
        }
        if (column === -1) {
            column = takeFreeLane(lanes);
        }

        const parentOids = new Set(commit.parents.map(parent => parent.oid));
        let isFirst = true;
        for (const parentOid of parentOids) {
            let lane = column;
            if (isFirst) {
                isFirst = false;
            } else {
                lane = lanes.indexOf(parentOid);
                if (lane === -1) {
                    lane = takeFreeLane(lanes);
                }
            }
            lanes[lane] = parentOid;
            lines.push({ half: 'bottom', lane });
        }

        while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
            lanes.pop();
        }

        let width = column + 1;
        for (const line of lines) {
            width = Math.max(width, line.lane + 1);
        }
        maxWidth = Math.max(maxWidth, width);

        rows.push({ oid: commit.oid, column, isMerge: commit.parents.length > 1, lines });
    }

    return { rows, maxWidth };
}

/** The first free lane — a new one at the right edge when none is free. */
function takeFreeLane(lanes: (string | null)[]): number {
    const free = lanes.indexOf(null);
    return free === -1 ? lanes.length : free;
}
