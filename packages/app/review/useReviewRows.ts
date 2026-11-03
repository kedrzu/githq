import { useService } from '@nzyme/vue-ioc/useService.js';
import { onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';

import { Clock } from '@/services/Clock.js';

import { buildFileLineRows, buildReviewRows } from './buildReviewRows.js';
import type { ReviewFileContent, ReviewRow } from './buildReviewRows.js';
import type { DiffLayout, DiffLineRange } from './diff/buildDiffRows.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import type { PullRequestFiles, ReviewFile, ReviewFileCollapseReason, ReviewFileState } from './ReviewFiles.js';
import { createFileSyntax } from './syntax/createFileSyntax.js';
import type { FileVersions } from './syntax/createFileSyntax.js';
import { listGoneEntries, placeThreads } from './threads/placeThreads.js';
import type { ThreadFileView, ThreadPlacement } from './threads/placeThreads.js';
import type { ReviewThread } from './threads/ReviewThread.js';

/** Options of {@link useReviewRows}. */
export interface UseReviewRowsOptions {
    files: MaybeRefOrGetter<PullRequestFiles | null>;
    /** The files in the order they show. */
    ordered: MaybeRefOrGetter<readonly ReviewFile[]>;
    layout: MaybeRefOrGetter<DiffLayout>;
    hideWhitespace: MaybeRefOrGetter<boolean>;
    /** The file in view: computing goes outward from it. */
    currentPath: MaybeRefOrGetter<string | null>;
}

/** Where the review threads show, as a new object whenever that changes. */
export interface ReviewThreadPlacements {
    /**
     * Every thread of every file listed, shown or not, and of the files not listed once the list stops growing, by the path
     * the thread names. In a file with no diff yet they are `inCollapsed`, until it has one.
     */
    readonly byFile: ReadonlyMap<string, readonly ThreadPlacement[]>;
    /** The paths of `byFile` that are an entry of their own (D12). */
    readonly goneEntries: readonly string[];
}

/** What {@link useReviewRows} returns. */
export interface ReviewRows {
    readonly rows: Readonly<ShallowRef<readonly ReviewRow[]>>;
    readonly threadPlacements: Readonly<ShallowRef<ReviewThreadPlacements>>;
}

type ReadyState = Extract<ReviewFileState, { kind: 'ready' }>;
type LinesContent = Extract<ReviewFileContent, { kind: 'lines' }>;

/** A file's rows in a layout, for as long as the same lines are expanded. */
interface BuiltLines {
    readonly expanded: readonly DiffLineRange[];
    readonly expansionReset: boolean;
    readonly content: LinesContent;
}

/** A file's threads as placed on a diff, for as long as the same threads and lines expanded. */
interface PlacedInDiff {
    readonly threads: readonly ReviewThread[];
    readonly expanded: readonly DiffLineRange[];
    readonly placements: readonly ThreadPlacement[];
}

/** How long a turn of computing diffs may take before the browser gets to draw. */
const COMPUTE_TURN_MS = 6;
/** Rows are rebuilt at most this often while diffs are being computed: one rebuild is O(all the rows). */
const REBUILD_EVERY_MS = 32;

const PLACEHOLDER: ReviewFileContent = { kind: 'placeholder' };
const PLACEHOLDER_FIRST: ReviewFileContent = { kind: 'placeholder', first: true };
const COLLAPSED: ReviewFileContent = { kind: 'collapsed' };
const COLLAPSED_VIEW: ThreadFileView = { kind: 'collapsed' };
const GONE_VIEW: ThreadFileView = { kind: 'gone' };

/**
 * The review's flat rows, as a new plain array whenever what they show changes. Diffs are computed on the main thread a
 * turn at a time, the files nearest the one in view first, so 225 files don't hold the first paint back; a file not yet
 * computed is a placeholder, like one not yet read. Each diff is kept by the file's content and the whitespace setting
 * and each file's rows by its diff, the layout and the lines expanded, so that a setting's second visit and a file's arrival compute only
 * what they must. Tokens are computed in a worker, in the same order: they change no row, only what a drawn one looks like.
 * Threads are placed with each rebuild, like the rows it builds, and only of files that have threads, each kept by what it
 * was placed on.
 */
export function useReviewRows(options: UseReviewRowsOptions): ReviewRows {
    const clock = useService(Clock);

    const rows = shallowRef<readonly ReviewRow[]>([]);
    // By the state object, which a new head replaces: what a moved pull request read before goes with it.
    const fullDiffs = new WeakMap<ReadyState, FileDiff>();
    const trimmedDiffs = new WeakMap<ReadyState, FileDiff>();
    const contents = new WeakMap<FileDiff, Partial<Record<DiffLayout, BuiltLines>>>();
    const syntax = createFileSyntax(findNextToTokenize);
    const threadPlacements = shallowRef<ReviewThreadPlacements>({ byFile: new Map(), goneEntries: [] });
    const placedInDiffs = new WeakMap<FileDiff, PlacedInDiff>();
    const placedElsewhere = new WeakMap<readonly ReviewThread[], Map<ThreadFileView, readonly ThreadPlacement[]>>();

    let builtFrom: readonly ReviewFileContent[] = [];
    let builtReasons: readonly (ReviewFileCollapseReason | null)[] = [];
    let builtFiles: readonly ReviewFile[] = [];
    let builtAt = Number.NEGATIVE_INFINITY;
    let cancelTurn: (() => void) | null = null;
    let threadsByFile: { from: readonly ReviewThread[]; byFile: Map<string, ReviewThread[]> } | null = null;

    watch(
        [
            () => toValue(options.files)?.version,
            () => toValue(options.ordered),
            () => toValue(options.layout),
            () => toValue(options.files)?.threads,
            () => toValue(options.files)?.files,
            () => toValue(options.files)?.listComplete,
            () => toValue(options.files)?.listFailing,
        ],
        () => {
            rebuild();
            scheduleTurn();
            syntax.tokenizeNext();
        },
        { immediate: true },
    );
    // What's on screen comes in the same frame, not after a flash of placeholders.
    watch(
        () => toValue(options.hideWhitespace),
        () => {
            builtAt = Number.NEGATIVE_INFINITY;
            computeTurn();
        },
    );
    onScopeDispose(() => {
        cancelTurn?.();
        syntax.dispose();
    });

    return { rows, threadPlacements };

    function rebuild() {
        placeAllThreads();
        const files = toValue(options.ordered);
        const next = files.map(getContent);
        const reasons = files.map(getCollapseReason);
        // Most new versions only say a file went from waiting to loading.
        if (
            files === builtFiles &&
            next.length === builtFrom.length &&
            next.every((c, i) => c === builtFrom[i]) &&
            reasons.every((reason, i) => reason === builtReasons[i])
        ) {
            return;
        }

        builtFiles = files;
        builtFrom = next;
        builtReasons = reasons;
        builtAt = clock.now();
        rows.value = buildReviewRows({ files, getContent, getCollapseReason });
    }

    function getContent(file: ReviewFile): ReviewFileContent {
        const state = getState(file);
        // Only ever a file that may yet turn out generated, or an open one: it says why it isn't here, which flips nothing.
        if (state?.kind === 'paused') {
            return state;
        }

        if (isCollapsed(file)) {
            return COLLAPSED;
        }

        if (!state) {
            return PLACEHOLDER;
        }

        switch (state.kind) {
            case 'waiting':
            case 'loading':
                return toValue(options.files)?.fetchingFirst === file.path ? PLACEHOLDER_FIRST : PLACEHOLDER;
            case 'ready': {
                const diff = getDiffs().get(state);
                return diff ? getLinesContent(file, state, diff) : PLACEHOLDER;
            }
            default:
                return state;
        }
    }

    function getState(file: ReviewFile) {
        return toValue(options.files)?.getState(file.path) ?? null;
    }

    function isCollapsed(file: ReviewFile) {
        return (toValue(options.files)?.getCollapse(file.path) ?? null) !== null;
    }

    function getCollapseReason(file: ReviewFile) {
        return toValue(options.files)?.getCollapseReason(file.path) ?? null;
    }

    function getDiffs() {
        return toValue(options.hideWhitespace) ? trimmedDiffs : fullDiffs;
    }

    function getLinesContent(file: ReviewFile, state: ReadyState, diff: FileDiff): LinesContent {
        const layout = toValue(options.layout);
        let byLayout = contents.get(diff);
        if (!byLayout) {
            byLayout = {};
            contents.set(diff, byLayout);
        }

        const expanded = toValue(options.files)?.getExpandedLines(file.path) ?? [];
        const expansionReset = toValue(options.files)?.isExpansionReset(file.path) ?? false;
        const built = byLayout[layout];
        if (built?.expanded === expanded && built.expansionReset === expansionReset) {
            return built.content;
        }

        const content: LinesContent = {
            kind: 'lines',
            rows: buildFileLineRows({
                path: file.path,
                diff,
                syntax: syntax.get({ path: file.path, before: state.before, after: state.after }),
                layout,
                expanded,
                expansionReset,
            }),
        };
        byLayout[layout] = { expanded, expansionReset, content };
        return content;
    }

    function placeAllThreads() {
        const files = toValue(options.files);
        const threads = files?.threads ?? [];
        if (threads.length === 0 && threadPlacements.value.byFile.size === 0) {
            return;
        }

        if (threadsByFile?.from !== threads) {
            const byPath = new Map<string, ReviewThread[]>();
            for (const thread of threads) {
                const fileThreads = byPath.get(thread.path);
                if (fileThreads) {
                    fileThreads.push(thread);
                } else {
                    byPath.set(thread.path, [thread]);
                }
            }

            threadsByFile = { from: threads, byFile: byPath };
        }

        const listed = new Set(files?.files.map(file => file.path));
        const listEnded = files != null && (files.listComplete || files.listFailing || files.pausedUntil !== null);
        const byFile = new Map<string, readonly ThreadPlacement[]>();
        for (const [path, fileThreads] of threadsByFile.byFile) {
            // Not gone yet, while a later page may yet list it.
            if (listed.has(path) || listEnded) {
                byFile.set(path, placeFileThreads(path, fileThreads, listed.has(path)));
            }
        }

        const published = threadPlacements.value.byFile;
        if (byFile.size !== published.size || [...byFile].some(([path, placed]) => published.get(path) !== placed)) {
            threadPlacements.value = { byFile, goneEntries: listGoneEntries(byFile) };
        }
    }

    function placeFileThreads(path: string, threads: readonly ReviewThread[], listed: boolean) {
        if (!listed) {
            return placeElsewhere(GONE_VIEW, threads);
        }

        const state = toValue(options.files)?.getState(path);
        const diff = state?.kind === 'ready' ? getDiffs().get(state) : undefined;
        if (!diff || toValue(options.files)?.getCollapse(path) != null) {
            return placeElsewhere(COLLAPSED_VIEW, threads);
        }

        const expanded = toValue(options.files)?.getExpandedLines(path) ?? [];
        const held = placedInDiffs.get(diff);
        if (held?.threads === threads && held.expanded === expanded) {
            return held.placements;
        }

        const start = performance.now();
        const placements = placeThreads({ kind: 'open', diff, expanded }, threads);
        performance.measure(`review:threads ${path}`, { start, end: performance.now() });
        placedInDiffs.set(diff, { threads, expanded, placements });
        return placements;
    }

    function placeElsewhere(view: ThreadFileView, threads: readonly ReviewThread[]) {
        let placed = placedElsewhere.get(threads);
        if (!placed) {
            placed = new Map();
            placedElsewhere.set(threads, placed);
        }

        let placements = placed.get(view);
        if (!placements) {
            placements = placeThreads(view, threads);
            placed.set(view, placements);
        }

        return placements;
    }

    function scheduleTurn() {
        if (cancelTurn === null && findNextToCompute() !== null) {
            cancelTurn = clock.schedule(computeTurn, 0);
        }
    }

    function computeTurn() {
        cancelTurn?.();
        cancelTurn = null;

        const started = clock.now();
        let next = findNextToCompute();
        while (next !== null && clock.now() - started < COMPUTE_TURN_MS) {
            computeDiff(next);
            next = findNextToCompute();
        }

        if (next === null || clock.now() - builtAt >= REBUILD_EVERY_MS) {
            rebuild();
        }

        if (next !== null) {
            cancelTurn = clock.schedule(computeTurn, 0);
        }
    }

    function computeDiff(file: ReviewFile) {
        const state = getState(file);
        if (state?.kind !== 'ready') {
            return;
        }

        const ignoreWhitespace = toValue(options.hideWhitespace);
        const start = performance.now();
        const diff = computeFileDiff({ before: state.before, after: state.after, ignoreWhitespace });
        getDiffs().set(state, diff);
        performance.measure(`review:diff ${file.path}`, { start, end: performance.now() });
    }

    /** The open ready file without a diff nearest the current one. */
    function findNextToCompute(): ReviewFile | null {
        return findNearest(file => {
            const state = getState(file);
            return state?.kind === 'ready' && !getDiffs().has(state) && !isCollapsed(file) ? file : null;
        });
    }

    /** The open read file nearest the current one that has a version to tokenize. */
    function findNextToTokenize(): FileVersions | null {
        return findNearest(file => {
            const state = getState(file);
            if (state?.kind !== 'ready' || isCollapsed(file)) {
                return null;
            }

            const versions = { path: file.path, before: state.before, after: state.after };
            return syntax.isPending(versions) ? versions : null;
        });
    }

    /** What `read` first finds, going outward from the current file, the one below first as that's where reading goes. */
    function findNearest<T>(read: (file: ReviewFile) => T | null): T | null {
        const files = toValue(options.ordered);
        const currentPath = toValue(options.currentPath);
        const current = Math.max(
            files.findIndex(file => file.path === currentPath),
            0,
        );
        for (let distance = 0; distance < files.length; distance++) {
            for (const index of distance === 0 ? [current] : [current + distance, current - distance]) {
                const file = files[index];
                const found = file ? read(file) : null;
                if (found !== null) {
                    return found;
                }
            }
        }

        return null;
    }
}
