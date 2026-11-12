import { groupByToMap } from '@nzyme/utils/array/groupByToMap.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';

import { Clock } from '@/services/Clock.js';

import { buildFileLineRows, buildPlaceholderRows, buildReviewRows } from './buildReviewRows.js';
import type { ReviewFileContent, ReviewRow } from './buildReviewRows.js';
import type { DiffLayout, DiffLineRange } from './diff/buildDiffRows.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
import type { FileDiff } from './diff/computeFileDiff.js';
import type { PullRequestFiles, ReviewFile, ReviewFileCollapseReason, ReviewFileState } from './ReviewFiles.js';
import { createFileSyntax } from './syntax/createFileSyntax.js';
import type { FileVersions } from './syntax/createFileSyntax.js';
import { groupThreadsByFile, listGoneEntries, placeThreads } from './threads/placeThreads.js';
import type { ThreadFileView, ThreadPlacement } from './threads/placeThreads.js';
import type { ReviewThread } from './threads/ReviewThread.js';
import type { ReviewCommentTarget } from './writing/ReviewWriting.js';

/** Options of {@link useReviewRows}. */
export interface UseReviewRowsOptions {
    files: MaybeRefOrGetter<PullRequestFiles | null>;
    /** The files in the order they show. */
    ordered: MaybeRefOrGetter<readonly ReviewFile[]>;
    layout: MaybeRefOrGetter<DiffLayout>;
    hideWhitespace: MaybeRefOrGetter<boolean>;
    /** The file in view: computing goes outward from it. */
    currentPath: MaybeRefOrGetter<string | null>;
    /** Whether a collapsed file shows its threads under its header (D13). */
    threadsInCollapsed: MaybeRefOrGetter<boolean>;
    /** The comment boxes open: rows are built of where they sit, never of what is typed in them. */
    commentTargets: MaybeRefOrGetter<readonly ReviewCommentTarget[]>;
}

/** Where the review threads show, as a new object whenever that changes. */
export interface ReviewThreadPlacements {
    /**
     * Every thread of every file listed, shown or not, and of the files not listed once the list stops growing, by the path
     * of the file they belong to (`groupThreadsByFile`). In a file with no diff yet they are `inCollapsed`, until it has one.
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
    readonly threads: readonly ThreadPlacement[] | undefined;
    readonly comments: readonly ReviewCommentTarget[] | undefined;
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
/** A file with no lines changed and no hunks to draw: its header alone until it is known what it is (D45). */
const HEADER_ONLY: ReviewFileContent = { kind: 'placeholder', rows: [] };
const HEADER_ONLY_FIRST: ReviewFileContent = { kind: 'placeholder', first: true, rows: [] };
/** Its two sides the same, but not a rename: what a diff of the two would show. */
const NO_LINES: ReviewFileContent = { kind: 'lines', rows: [] };
/** What the patch says (D45) of a file whose blob hasn't said more: no sizes yet. */
const BINARY: ReviewFileContent = { kind: 'binary', before: null, after: null };
const RENAMED_UNCHANGED: ReviewFileContent = { kind: 'renamedUnchanged' };
const COLLAPSED: ReviewFileContent = { kind: 'collapsed' };
const GONE: ReviewFileContent = { kind: 'gone' };
const COLLAPSED_VIEW: ThreadFileView = { kind: 'collapsed', notLoaded: false };
const NOT_LOADED_VIEW: ThreadFileView = { kind: 'collapsed', notLoaded: true };
const GONE_VIEW: ThreadFileView = { kind: 'gone' };

/**
 * The review's flat rows, as a new plain array whenever what they show changes. Diffs are computed on the main thread a
 * turn at a time, the files nearest the one in view first, so 225 files don't hold the first paint back; a file not yet
 * computed is a placeholder, like one not yet read, in its patch's layout once that is in (D45). Each diff is kept by the file's content and the whitespace setting
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
    // By the file, which its patch's arrival replaces, then by what it is drawn as.
    const placeholders = new WeakMap<ReviewFile, Map<string, ReviewFileContent>>();

    let builtFrom: readonly ReviewFileContent[] = [];
    let builtReasons: readonly (ReviewFileCollapseReason | null)[] = [];
    let builtFiles: readonly ReviewFile[] = [];
    let builtAt = Number.NEGATIVE_INFINITY;
    let cancelTurn: (() => void) | null = null;
    let builtPlacements = threadPlacements.value;
    let builtThreadsInCollapsed = toValue(options.threadsInCollapsed);
    let threadsByFile = new Map<string, readonly ReviewThread[]>();
    let builtTargets: readonly ReviewCommentTarget[] = [];
    let commentsByFile: ReadonlyMap<string, readonly ReviewCommentTarget[]> = new Map();

    watch(
        [
            () => toValue(options.files)?.version,
            () => toValue(options.ordered),
            () => toValue(options.layout),
            () => toValue(options.files)?.threads,
            () => toValue(options.files)?.files,
            () => toValue(options.files)?.listEnd,
            () => toValue(options.threadsInCollapsed),
            () => toValue(options.commentTargets),
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

    // A pull request held in memory is back in place at once: no frame of placeholders where its text is at hand.
    if (cancelTurn !== null) {
        builtAt = Number.NEGATIVE_INFINITY;
        computeTurn();
    }

    return { rows, threadPlacements };

    function rebuild() {
        placeAllThreads();
        const targets = toValue(options.commentTargets);
        if (targets !== builtTargets) {
            commentsByFile = groupComments(targets);
        }

        const files = toValue(options.ordered);
        const next = files.map(getContent);
        const reasons = files.map(getCollapseReason);
        // Most new versions only say a file went from waiting to loading.
        if (
            files === builtFiles &&
            threadPlacements.value === builtPlacements &&
            targets === builtTargets &&
            toValue(options.threadsInCollapsed) === builtThreadsInCollapsed &&
            next.length === builtFrom.length &&
            next.every((c, i) => c === builtFrom[i]) &&
            reasons.every((reason, i) => reason === builtReasons[i])
        ) {
            return;
        }

        builtFiles = files;
        builtPlacements = threadPlacements.value;
        builtTargets = targets;
        builtThreadsInCollapsed = toValue(options.threadsInCollapsed);
        builtFrom = next;
        builtReasons = reasons;
        builtAt = clock.now();
        rows.value = buildReviewRows({
            files,
            getContent,
            getCollapseReason,
            getThreads: file => threadPlacements.value.byFile.get(file.path),
            getComments: file => commentsByFile.get(file.path),
            threadsInCollapsed: builtThreadsInCollapsed,
        });
    }

    function getContent(file: ReviewFile): ReviewFileContent {
        if (file.gone) {
            return GONE;
        }

        // The patch's verdict stays whatever its blob is up to, unless the blob says otherwise (D45).
        const verdict = file.patch?.verdict ?? null;
        const state = getState(file);
        // Only ever a file that may yet turn out generated, or an open one: it says why it isn't here, which flips nothing.
        if (state?.kind === 'paused') {
            return verdict === 'binary' && !isCollapsed(file) ? BINARY : state;
        }

        if (isCollapsed(file)) {
            return COLLAPSED;
        }

        if (!state) {
            return verdict === 'binary' ? BINARY : getPlaceholder(file, false);
        }

        switch (state.kind) {
            case 'waiting':
            case 'loading':
                return verdict === 'binary'
                    ? BINARY
                    : getPlaceholder(file, toValue(options.files)?.fetchingFirst === file.path);
            case 'ready': {
                const diff = getDiffs().get(state);
                if (diff) {
                    return getLinesContent(file, state, diff);
                }

                // Its blob said otherwise (an empty file, a mode change), which shows once it is diffed.
                return verdict === 'binary' ? BINARY : getPlaceholder(file, false);
            }
            case 'unchanged':
                return file.changeType === 'RENAMED' ? RENAMED_UNCHANGED : NO_LINES;
            case 'failed':
                return verdict === 'binary' ? BINARY : state;
            default:
                return state;
        }
    }

    /** The same object for as long as the file, the layout and the whitespace setting stay: rows are kept by that. */
    function getPlaceholder(file: ReviewFile, first: boolean): ReviewFileContent {
        if (!file.patch?.layout) {
            if (file.additions === 0 && file.deletions === 0) {
                return first ? HEADER_ONLY_FIRST : HEADER_ONLY;
            }

            return first ? PLACEHOLDER_FIRST : PLACEHOLDER;
        }

        const layout = toValue(options.layout);
        const hideWhitespace = toValue(options.hideWhitespace);
        let byView = placeholders.get(file);
        if (!byView) {
            byView = new Map();
            placeholders.set(file, byView);
        }

        const key = `${layout}:${hideWhitespace}:${first}`;
        let content = byView.get(key);
        if (!content) {
            content = { kind: 'placeholder', first, rows: buildPlaceholderRows({ file, layout, hideWhitespace }) };
            byView.set(key, content);
        }

        return content;
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
        const threads = threadPlacements.value.byFile.get(file.path);
        const comments = commentsByFile.get(file.path);
        const built = byLayout[layout];
        if (
            built?.expanded === expanded &&
            built.expansionReset === expansionReset &&
            built.threads === threads &&
            built.comments === comments
        ) {
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
                threads,
                comments,
            }),
        };
        byLayout[layout] = { expanded, expansionReset, threads, comments, content };
        return content;
    }

    /** The same array for a file whose boxes stayed the same: its rows are kept by that. */
    function groupComments(targets: readonly ReviewCommentTarget[]) {
        const grouped = new Map<string, readonly ReviewCommentTarget[]>();
        for (const [path, inFile] of groupByToMap(targets, target => target.path)) {
            const held = commentsByFile.get(path);
            const same = held?.length === inFile.length && inFile.every((target, i) => target === held[i]);
            grouped.set(path, same ? held : inFile);
        }

        return grouped;
    }

    function placeAllThreads() {
        const files = toValue(options.files);
        const threads = files?.threads ?? [];
        if (threads.length === 0 && threadPlacements.value.byFile.size === 0) {
            return;
        }

        threadsByFile = regroupThreads(threads, files?.files ?? []);
        const listed = new Map(files?.files.map(file => [file.path, file]));
        const listEnded = files != null && files.listEnd !== 'growing';
        const byFile = new Map<string, readonly ThreadPlacement[]>();
        for (const [path, fileThreads] of threadsByFile) {
            // Not gone yet, while a later page may yet list it or a rename account for it.
            if (listed.has(path) || listEnded) {
                byFile.set(path, placeFileThreads(path, fileThreads, listed.get(path)));
            }
        }

        const published = threadPlacements.value.byFile;
        if (byFile.size !== published.size || [...byFile].some(([path, placed]) => published.get(path) !== placed)) {
            threadPlacements.value = { byFile, goneEntries: listGoneEntries(byFile) };
        }
    }

    /** The same array for a file whose threads stayed the same: what was placed on it is kept by that. */
    function regroupThreads(threads: readonly ReviewThread[], listed: readonly ReviewFile[]) {
        const regrouped = new Map<string, readonly ReviewThread[]>();
        for (const [path, fileThreads] of groupThreadsByFile(threads, listed)) {
            const held = threadsByFile.get(path);
            const same = held?.length === fileThreads.length && fileThreads.every((t, i) => t === held[i]);
            regrouped.set(path, same ? held : fileThreads);
        }

        return regrouped;
    }

    function placeFileThreads(path: string, threads: readonly ReviewThread[], file: ReviewFile | undefined) {
        if (!file) {
            return placeElsewhere(GONE_VIEW, threads);
        }

        const state = toValue(options.files)?.getState(path);
        const diff = state?.kind === 'ready' ? getDiffs().get(state) : undefined;
        const collapse = toValue(options.files)?.getCollapse(path) ?? null;
        if (!diff || collapse !== null) {
            const notLoaded =
                collapse !== null &&
                collapse !== 'undecided' &&
                (state?.kind === 'waiting' || state?.kind === 'loading' || state?.kind === 'paused');
            return placeElsewhere(notLoaded ? NOT_LOADED_VIEW : COLLAPSED_VIEW, threads);
        }

        const expanded = toValue(options.files)?.getExpandedLines(path) ?? [];
        const held = placedInDiffs.get(diff);
        if (held?.threads === threads && held.expanded === expanded) {
            return held.placements;
        }

        const start = performance.now();
        const placements = placeThreads(
            { kind: 'open', diff, expanded, deleted: file.changeType === 'DELETED' },
            threads,
        );
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
        const currentPath = toValue(options.currentPath);
        let next = findNextToCompute();
        // What's on screen doesn't wait for the rest.
        let currentComputed = false;
        while (next !== null && clock.now() - started < COMPUTE_TURN_MS) {
            currentComputed ||= next.path === currentPath;
            computeDiff(next);
            next = findNextToCompute();
        }

        if (next === null || currentComputed || clock.now() - builtAt >= REBUILD_EVERY_MS) {
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
