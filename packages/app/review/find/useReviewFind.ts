import { assertNever } from '@nzyme/utils/assertNever.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { Clock } from '@/services/Clock.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';

import type { ReviewRow } from '../buildReviewRows.js';
import { collectFindLines } from './collectFindLines.js';
import type { ReviewFindLine } from './collectFindLines.js';
import type { FindOptions } from './compileFindQuery.js';
import { createFindRunner } from './createFindRunner.js';
import type { FindState } from './createFindRunner.js';
import { findCurrentMatch, getMatchIdentity } from './findCurrentMatch.js';
import type { FindCurrentMatchFrom, FindMatchIdentity } from './findCurrentMatch.js';
import type { DiffMatches } from './findDiffMatches.js';
import { getRowMarks, indexRowMatches } from './RowMarks.js';
import type { RowMarks } from './RowMarks.js';

/** Options of {@link useReviewFind}. */
export interface UseReviewFindOptions {
    /** The review's rows, as drawn. */
    rows: MaybeRefOrGetter<readonly ReviewRow[]>;
    /** What the find bar holds. */
    query: MaybeRefOrGetter<string>;
    /** Whether the find bar is open: closed, nothing is searched or marked. */
    active: MaybeRefOrGetter<boolean>;
    /** The key of the row the cursor is on, `null` for none: a new query lands on the first match from there. */
    cursorKey: MaybeRefOrGetter<string | null>;
    /**
     * Given the row of a step asked for while what is typed was still being searched (Enter right after typing): the step
     * is taken once its matches land, as {@link ReviewFindViewModel.next} would have given it.
     */
    onGo: (rowKey: string) => void;
}

/** What {@link useReviewFind} returns. */
export interface ReviewFindViewModel {
    readonly state: FindState;
    /** How many matches there are to step through. */
    readonly total: number;
    /** The current match's place among those, 0-based; `null` for none. */
    readonly position: number | null;
    /** Some line had more matches than are kept. */
    readonly capped: boolean;
    /** Every file's lines are in the rows: no placeholder could add matches. */
    readonly final: boolean;
    /** How the query is read, kept in every review. */
    readonly options: FindOptions;
    toggle(option: keyof FindOptions): void;
    /**
     * Steps to the next match, wrapping, and gives its row's key for the caller to go to; `null` when there's none, or
     * when what is typed isn't searched yet: the step then goes to `onGo` once it is.
     */
    next(): string | null;
    /** Steps to the previous match, wrapping, like {@link next}. */
    previous(): string | null;
    /** The marks of a row's matches, `null` for a row without any. Reactive: a drawn row follows the results and steps. */
    getRowMarks(rowKey: string): RowMarks | null;
}

/** A search's matches with the lines and rows they point into. */
interface FindResult {
    readonly query: string;
    readonly rows: readonly ReviewRow[];
    readonly lines: readonly ReviewFindLine[];
    readonly matches: DiffMatches;
}

/** The match find is on. */
interface CurrentMatch {
    /** Among the counted matches of the current result. */
    readonly position: number;
    readonly identity: FindMatchIdentity;
}

/** A search sent and not answered yet. */
type PendingSearch = Omit<FindResult, 'matches'>;

/** How long typing or a change of the rows waits before it is searched. */
const SEARCH_DELAY_MS = 150;

/**
 * VS Code-style find in a review's code: the lines of the rows are searched in a worker a moment after the query or the
 * rows change, and the matches are marked and stepped through. The match find is on is kept by what it is in the code,
 * so a new result of the same query (rows rebuilt, the layout or the whitespace setting switched) stays on it, or goes on
 * to the next one if it is gone; a new query lands on the first match from the cursor. Nothing here scrolls: only a step
 * gives the caller a row to go to.
 */
export function useReviewFind(options: UseReviewFindOptions): ReviewFindViewModel {
    const clock = useService(Clock);
    const preferences = useService(LocalPreferences);

    const rows = makeRef(options.rows);
    const query = makeRef(options.query);
    const active = makeRef(options.active);
    const cursorKey = makeRef(options.cursorKey);
    const state = shallowRef<FindState>({ status: 'idle' });
    const result = shallowRef<FindResult | null>(null);
    const current = shallowRef<CurrentMatch | null>(null);
    const findOptions = computed((): FindOptions => ({
        matchCase: preferences.reviewFindCase.value,
        wholeWord: preferences.reviewFindWord.value,
        regex: preferences.reviewFindRegex.value,
    }));
    const searched = computed(() => (active.value ? query.value : ''));
    const rowMatches = computed(() =>
        result.value ? indexRowMatches(result.value.lines, result.value.matches) : null,
    );
    const final = computed(() => !rows.value.some(row => row.kind === 'placeholder'));
    const runner = createFindRunner({ onChange: receive });
    let pending: PendingSearch | null = null;
    let cancelSearch: (() => void) | null = null;
    /** What is typed, or a toggle, waits to be searched: its matches aren't those of the last result. */
    let queryWaiting = false;
    /** What was typed, or a toggle, is being searched: the matches shown aren't its own yet. */
    let querySearching = false;
    /** A step asked for before the query's matches landed, taken as they do. */
    let waitingStep: 1 | -1 | null = null;

    // Typing waits for a pause; the rows, rebuilt every few frames while diffs are computed, don't push the search back.
    watch([searched, findOptions], () => schedule(true), { immediate: true });
    watch(rows, () => schedule(false));
    onScopeDispose(() => {
        cancelSearch?.();
        runner.dispose();
    });

    return reactive<ReviewFindViewModel>({
        state,
        total: computed(() => result.value?.matches.counted.length ?? 0),
        position: computed(() => current.value?.position ?? null),
        capped: computed(() => result.value?.matches.capped ?? false),
        final,
        options: findOptions,
        toggle,
        next,
        previous,
        getRowMarks: readRowMarks,
    });

    function schedule(restart: boolean) {
        if (searched.value.length === 0) {
            // Nothing to wait for: closing the bar or clearing the query takes the marks away at once.
            search();
            return;
        }

        queryWaiting ||= restart;
        if (restart || cancelSearch === null) {
            cancelSearch?.();
            cancelSearch = clock.schedule(search, SEARCH_DELAY_MS);
        }
    }

    function search() {
        cancelSearch?.();
        cancelSearch = null;
        querySearching ||= queryWaiting;
        queryWaiting = false;
        const lines = collectFindLines(rows.value);
        pending = { query: searched.value, rows: rows.value, lines };
        runner.search({ lines, query: pending.query, options: findOptions.value });
    }

    function receive(changed: FindState) {
        state.value = changed;
        switch (changed.status) {
            case 'searching':
                return;
            case 'done':
                querySearching = false;
                if (pending) {
                    land({ ...pending, matches: changed.matches });
                }

                takeWaitingStep();
                return;
            case 'idle':
            case 'invalid':
            case 'tooSlow':
                querySearching = false;
                waitingStep = null;
                result.value = null;
                current.value = null;
                return;
            default:
                assertNever(changed);
        }
    }

    /** Takes a new result, keeping the match find was on when the query typed is the same, whatever the toggles say. */
    function land(found: FindResult) {
        const kept = current.value;
        const from: FindCurrentMatchFrom =
            kept && result.value?.query === found.query
                ? { kind: 'kept', identity: kept.identity }
                : { kind: 'cursor', cursorKey: cursorKey.value };
        result.value = found;
        setCurrent(findCurrentMatch({ ...found, from }));
    }

    function next() {
        return step(1);
    }

    function previous() {
        return step(-1);
    }

    function step(by: 1 | -1) {
        if (queryWaiting || querySearching) {
            // What is typed isn't searched yet: search it now rather than step through the matches of what was, and take
            // the step once they land. Rows waiting don't hold a step back: they are rebuilt every few frames while diffs
            // are computed.
            if (queryWaiting) {
                search();
            }

            waitingStep = by;
            return null;
        }

        const found = result.value;
        if (!found) {
            return null;
        }

        const total = found.matches.counted.length;
        if (total === 0) {
            return null;
        }

        const at = current.value?.position;
        const position =
            at === undefined
                ? (findCurrentMatch({ ...found, from: { kind: 'cursor', cursorKey: cursorKey.value } }) ?? 0) +
                  (by > 0 ? 0 : -1)
                : at + by;
        const wrapped = (position + total) % total;
        setCurrent(wrapped);
        return getRowKey(found, wrapped);
    }

    /** A new query landed on the first match from the cursor: that is where a step forward goes, back the one before it. */
    function takeWaitingStep() {
        const by = waitingStep;
        waitingStep = null;
        const found = result.value;
        const at = current.value?.position;
        if (by === null || !found || at === undefined) {
            return;
        }

        const total = found.matches.counted.length;
        const position = by > 0 ? at : (at - 1 + total) % total;
        setCurrent(position);
        const rowKey = getRowKey(found, position);
        if (rowKey !== null) {
            options.onGo(rowKey);
        }
    }

    function setCurrent(position: number | null) {
        const found = result.value;
        const identity = found && position !== null ? getMatchIdentity(found.lines, found.matches, position) : null;
        current.value = identity && position !== null ? { position, identity } : null;
    }

    function readRowMarks(rowKey: string) {
        const found = result.value;
        const range = rowMatches.value?.get(rowKey);
        if (!found || !range) {
            return null;
        }

        const position = current.value?.position;
        const at = position === undefined ? null : (found.matches.counted[position] ?? null);
        return getRowMarks({ lines: found.lines, matches: found.matches, range, current: at });
    }

    function toggle(option: keyof FindOptions) {
        switch (option) {
            case 'matchCase':
                preferences.reviewFindCase.value = !preferences.reviewFindCase.value;
                break;
            case 'wholeWord':
                preferences.reviewFindWord.value = !preferences.reviewFindWord.value;
                break;
            case 'regex':
                preferences.reviewFindRegex.value = !preferences.reviewFindRegex.value;
                break;
        }
    }
}

function getRowKey({ lines, matches }: FindResult, position: number) {
    const at = matches.counted[position];
    return at === undefined ? null : (lines[matches.lines[at] ?? -1]?.key ?? null);
}
