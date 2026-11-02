/** The most lines a stack's map shows in a panel (D17): its rows and the lines folding the rest. */
const MAX_LINES = 6;
/** The rows shown before the open one in a long stack. */
const ROWS_BEFORE = 1;
/** The rows shown after the open one in a long stack. */
const ROWS_AFTER = 2;

/** The rows of a stack's map a panel shows, `start` to `end` inclusive; those before and after fold into a line each. */
export interface StackMapWindow {
    readonly start: number;
    readonly end: number;
}

/**
 * The window of a stack's map in a panel (D17, SP31): every row of a stack of six or fewer; otherwise one before the
 * open one, the open one and two after, the rest folded into a line on each side — at most six lines in all. A side with
 * nothing to fold gives its line to one more row, and a fold that would hold one pull request shows it as its row.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getStackMapWindow(count: number, current: number): StackMapWindow {
    const last = count - 1;
    if (count <= MAX_LINES) {
        return { start: 0, end: last };
    }

    const rows = ROWS_BEFORE + 1 + ROWS_AFTER;
    let start = Math.min(Math.max(current - ROWS_BEFORE, 0), count - rows);
    let end = start + rows - 1;
    if (start === 0) {
        end++;
    } else if (end === last) {
        start--;
    }

    if (start === 1) {
        start = 0;
    }

    if (end === last - 1) {
        end = last;
    }

    return { start, end };
}
