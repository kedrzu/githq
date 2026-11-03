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

type ReadyState = Extract<ReviewFileState, { kind: 'ready' }>;
type LinesContent = Extract<ReviewFileContent, { kind: 'lines' }>;

/** A file's rows in a layout, for as long as the same lines are expanded. */
interface BuiltLines {
    readonly expanded: readonly DiffLineRange[];
    readonly content: LinesContent;
}

/** How long a turn of computing diffs may take before the browser gets to draw. */
const COMPUTE_TURN_MS = 6;
/** Rows are rebuilt at most this often while diffs are being computed: one rebuild is O(all the rows). */
const REBUILD_EVERY_MS = 32;

const PLACEHOLDER: ReviewFileContent = { kind: 'placeholder' };
const PLACEHOLDER_FIRST: ReviewFileContent = { kind: 'placeholder', first: true };
const COLLAPSED: ReviewFileContent = { kind: 'collapsed' };

/**
 * The review's flat rows, as a new plain array whenever what they show changes. Diffs are computed on the main thread a
 * turn at a time, the files nearest the one in view first, so 225 files don't hold the first paint back; a file not yet
 * computed is a placeholder, like one not yet read. Each diff is kept by the file's content and the whitespace setting
 * and each file's rows by its diff, the layout and the lines expanded, so that a setting's second visit and a file's arrival compute only
 * what they must. Tokens are computed in a worker, in the same order: they change no row, only what a drawn one looks like.
 */
export function useReviewRows(options: UseReviewRowsOptions): Readonly<ShallowRef<readonly ReviewRow[]>> {
    const clock = useService(Clock);

    const rows = shallowRef<readonly ReviewRow[]>([]);
    // By the state object, which a new head replaces: what a moved pull request read before goes with it.
    const fullDiffs = new WeakMap<ReadyState, FileDiff>();
    const trimmedDiffs = new WeakMap<ReadyState, FileDiff>();
    const contents = new WeakMap<FileDiff, Partial<Record<DiffLayout, BuiltLines>>>();
    const syntax = createFileSyntax(findNextToTokenize);

    let builtFrom: readonly ReviewFileContent[] = [];
    let builtReasons: readonly (ReviewFileCollapseReason | null)[] = [];
    let builtFiles: readonly ReviewFile[] = [];
    let builtAt = Number.NEGATIVE_INFINITY;
    let cancelTurn: (() => void) | null = null;

    watch(
        [() => toValue(options.files)?.version, () => toValue(options.ordered), () => toValue(options.layout)],
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

    return rows;

    function rebuild() {
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
        const built = byLayout[layout];
        if (built?.expanded === expanded) {
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
            }),
        };
        byLayout[layout] = { expanded, content };
        return content;
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
