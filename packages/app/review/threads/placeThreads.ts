import { assertNever } from '@nzyme/utils/assertNever.js';

import { CONTEXT_LINES } from '../buildReviewRows.js';
import { buildDiffRows, getDiffLineRowKey } from '../diff/buildDiffRows.js';
import type { DiffLayout, DiffLineRange, DiffLineSide } from '../diff/buildDiffRows.js';
import type { DiffRange, FileDiff } from '../diff/computeFileDiff.js';
import type { ReviewFile } from '../ReviewFiles.js';
import type { ReviewThread } from './ReviewThread.js';

/** What a file shows, which decides where its threads go. */
export type ThreadFileView =
    /** Its diff is here: `expanded` as `BuildDiffRowsOptions.expanded`, so that what is hidden is what the rows hide. */
    | { readonly kind: 'open'; readonly diff: FileDiff; readonly expanded: readonly DiffLineRange[] }
    /** Its text isn't here: collapsed and not fetched (D13), or with no diff to show, for now or for good. */
    | { readonly kind: 'collapsed' }
    /** Not in the list of files (D12). */
    | { readonly kind: 'gone' };

/** A line of the file a thread has found: its last, with a range. */
interface PlacedOnLine {
    readonly thread: ReviewThread;
    readonly side: DiffLineSide;
    /** 1-based. */
    readonly line: number;
    /** An outdated thread that found its line by its text: "placed by finding its line again" (D30). */
    readonly approximate: boolean;
}

/** On a line the file's rows show: the thread goes right after the row. */
export interface ThreadOnLine extends PlacedOnLine {
    readonly kind: 'onLine';
    /** The row's `DiffRow.key`, which is not the same in both layouts on a changed line. */
    readonly rowKeys: Readonly<Record<DiffLayout, string>>;
}

/** On a line in a gap between the rows: shown with its code, apart from them (D13, D29). */
export interface ThreadOnHiddenLine extends PlacedOnLine {
    readonly kind: 'hiddenLine';
    /** The gap it is in: the same range as the gap row's. */
    readonly gap: DiffRange;
    /** How many lines it is from the nearest row; from the file's top if no row shows at all. */
    readonly distance: number;
    /** Which way it is from that row: `down` is "172 lines further down". */
    readonly direction: 'up' | 'down';
    /** The code to show, lines `firstLine` to `line` of `side`: up to three, never one a row shows, ending on its line. */
    readonly firstLine: number;
    /** The line changed, in whitespace only and with that hidden (CR11). */
    readonly whitespaceChange: boolean;
}

/** Above the file's first change, closed off from it, with the code it was written on (D30). */
export interface ThreadAtFileTop {
    readonly kind: 'fileTop';
    readonly thread: ReviewThread;
    /** Empty on a `FILE` thread, which GitHub gives no code. */
    readonly diffHunk: string;
    readonly commit: ReviewThread['comments'][number]['originalCommit'];
}

/** Under the header of a file whose text isn't here: "as it was when commented" (D13, D29). */
export interface ThreadInCollapsed {
    readonly kind: 'inCollapsed';
    readonly thread: ReviewThread;
    /** Empty on a `FILE` thread. */
    readonly diffHunk: string;
}

/** In the entry of a file gone from the diff (D12): see {@link listGoneEntries}. */
export interface ThreadOnGoneFile {
    readonly kind: 'gone';
    readonly thread: ReviewThread;
    readonly diffHunk: string;
}

/** Where a thread shows. Resolved ones go the same way, for each thread is drawn wherever it is. */
export type ThreadPlacement =
    | ThreadAtFileTop
    | ThreadInCollapsed
    | ThreadOnGoneFile
    | ThreadOnHiddenLine
    | ThreadOnLine;

/** How many lines of code show with a thread on a hidden line. */
const HIDDEN_LINE_CODE = 3;
/** The place of a line found more than once, which says nothing of where a thread is (D12). */
const REPEATED = -1;

/**
 * Where each of a file's threads shows, one placement per thread in the order given: nothing a thread says can make it
 * fall out (D12, D13, D15). Whitespace matters only through the diff.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function placeThreads(view: ThreadFileView, threads: readonly ReviewThread[]): ThreadPlacement[] {
    switch (view.kind) {
        case 'open':
            return placeInDiff(view.diff, view.expanded, threads);
        case 'collapsed':
            return threads.map(thread => ({ kind: 'inCollapsed', thread, diffHunk: getDiffHunk(thread) }));
        case 'gone':
            return threads.map(thread => ({ kind: 'gone', thread, diffHunk: getDiffHunk(thread) }));
        default:
            return assertNever(view);
    }
}

/**
 * The files gone from the diff that keep an entry of their own: those with an unresolved thread (D12). The one way a
 * thread stops being shown.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function listGoneEntries(placements: ReadonlyMap<string, readonly ThreadPlacement[]>): string[] {
    return [...placements]
        .filter(([, placed]) => placed.some(({ kind, thread }) => kind === 'gone' && !thread.isResolved))
        .map(([path]) => path);
}

/**
 * Each file's threads, by the path of the file they belong to: the one they name, or what a file listed there was renamed
 * to in the pull request, for a thread on `X` belongs on `Y` once `X` became `Y`. A path nothing lists keeps its threads,
 * for {@link placeThreads} to call them gone.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupThreadsByFile(
    threads: readonly ReviewThread[],
    files: readonly ReviewFile[],
): Map<string, ReviewThread[]> {
    const listed = new Set(files.map(file => file.path));
    const renamedTo = new Map<string, string>();
    for (const { path, previousPath, changeType } of files) {
        if (changeType === 'RENAMED' && previousPath !== null && !listed.has(previousPath)) {
            renamedTo.set(previousPath, path);
        }
    }

    const byFile = new Map<string, ReviewThread[]>();
    for (const thread of threads) {
        const path = renamedTo.get(thread.path) ?? thread.path;
        const fileThreads = byFile.get(path);
        if (fileThreads) {
            fileThreads.push(thread);
        } else {
            byFile.set(path, [thread]);
        }
    }

    return byFile;
}

function placeInDiff(
    diff: FileDiff,
    expanded: readonly DiffLineRange[],
    threads: readonly ReviewThread[],
): ThreadPlacement[] {
    // Only when asked for: a file may have nothing but threads that find no line.
    const placesOfLines: Partial<Record<DiffLineSide, Map<string, number>>> = {};
    let gaps: DiffRange[] | null = null;

    return threads.map((thread): ThreadPlacement => {
        const side: DiffLineSide = thread.diffSide === 'LEFT' ? 'before' : 'after';
        const line = findThreadLine(thread, side);
        if (line === null) {
            return {
                kind: 'fileTop',
                thread,
                diffHunk: getDiffHunk(thread),
                commit: thread.comments[0]?.originalCommit ?? null,
            };
        }

        const placed = { thread, side, line, approximate: thread.isOutdated };
        gaps ??= buildDiffRows(diff, { layout: 'unified', context: CONTEXT_LINES, expanded }).flatMap(row =>
            row.kind === 'gap' ? [row.range] : [],
        );
        const gap = gaps.find(range => getSideStart(range, side) < line && line <= getSideEnd(range, side));
        return gap
            ? { kind: 'hiddenLine', ...placed, gap, ...getHiddenPlace(diff, gap, side, line) }
            : {
                  kind: 'onLine',
                  ...placed,
                  rowKeys: {
                      split: getDiffLineRowKey(diff, { side, line }, 'split'),
                      unified: getDiffLineRowKey(diff, { side, line }, 'unified'),
                  },
              };
    });

    /** The 1-based line it belongs on in the file as it is now; `null` when that is no line of it. */
    function findThreadLine(thread: ReviewThread, side: DiffLineSide) {
        if (thread.subjectType === 'FILE') {
            return null;
        }

        if (thread.isOutdated) {
            const text = getCommentedText(getDiffHunk(thread));
            const place = text === null ? undefined : getPlacesOfLines(side).get(text);
            return place === undefined || place === REPEATED ? null : place + 1;
        }

        // GitHub says it isn't outdated, but this is a file read at another moment than the thread.
        return thread.line !== null && thread.line >= 1 && thread.line <= diff[side].length ? thread.line : null;
    }

    function getPlacesOfLines(side: DiffLineSide) {
        let places = placesOfLines[side];
        if (!places) {
            places = new Map();
            for (const [index, text] of diff[side].entries()) {
                places.set(text, places.has(text) ? REPEATED : index);
            }

            placesOfLines[side] = places;
        }

        return places;
    }
}

function getHiddenPlace(diff: FileDiff, gap: DiffRange, side: DiffLineSide, line: number) {
    const start = getSideStart(gap, side);
    const end = getSideEnd(gap, side);
    const offset = line - 1 - start;
    const firstLine = Math.max(line - HIDDEN_LINE_CODE + 1, start + 1);
    const whitespaceChange = diff.before[gap.beforeStart + offset] !== diff.after[gap.afterStart + offset];
    const fromAbove = line - start;
    const fromBelow = end + 1 - line;
    const hasRowAbove = start > 0;
    const hasRowBelow = end < diff[side].length;
    if (!hasRowAbove && !hasRowBelow) {
        return { distance: line, direction: 'down', firstLine, whitespaceChange } as const;
    }

    return hasRowAbove && (!hasRowBelow || fromAbove <= fromBelow)
        ? ({ distance: fromAbove, direction: 'down', firstLine, whitespaceChange } as const)
        : ({ distance: fromBelow, direction: 'up', firstLine, whitespaceChange } as const);
}

function getSideStart(range: DiffRange, side: DiffLineSide) {
    return side === 'before' ? range.beforeStart : range.afterStart;
}

function getSideEnd(range: DiffRange, side: DiffLineSide) {
    return side === 'before' ? range.beforeEnd : range.afterEnd;
}

function getDiffHunk(thread: ReviewThread) {
    return thread.comments[0]?.diffHunk ?? '';
}

/** The commented line of a `diffHunk`, its last, without its `+`, `-` or space; `null` for a hunk with no code. */
function getCommentedText(diffHunk: string) {
    const lines = diffHunk.split('\n');
    // "\ No newline at end of file" says something of the line above it.
    const last = lines.findLast(line => !line.startsWith('\\'));
    if (last === undefined || last === '' || last.startsWith('@@')) {
        return null;
    }

    return last.slice(1).replace(/\r$/u, '');
}
