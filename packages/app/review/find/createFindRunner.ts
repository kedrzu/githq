import { compileFindQuery } from './compileFindQuery.js';
import type { FindOptions } from './compileFindQuery.js';
import type { DiffMatches, FindLine } from './findDiffMatches.js';
import type { FindRequest, FindResponse } from './find.worker.js';

/** Where a search stands. */
export type FindState =
    /** Nothing to search for. */
    | { readonly status: 'idle' }
    /** The pattern doesn't compile. */
    | { readonly status: 'invalid' }
    /** On its way; the last search's matches, if any, still show meanwhile. */
    | { readonly status: 'searching'; readonly matches: DiffMatches | null }
    /** It took longer than the budget and was stopped. */
    | { readonly status: 'tooSlow' }
    | { readonly status: 'done'; readonly matches: DiffMatches };

/** A search to run. */
export interface FindSearch {
    /** The lines, in the diff's order: a match points at its line by the index in them. */
    readonly lines: readonly FindLine[];
    readonly query: string;
    readonly options: FindOptions;
}

/** How {@link createFindRunner} runs searches. */
export interface FindRunnerOptions {
    /** Told every new state. */
    readonly onChange: (state: FindState) => void;
    /** How long a search may take, in milliseconds, before it is stopped. 1500 unless given. */
    readonly budget?: number;
    /** Starts the worker that searches. The app's own `find.worker.ts` unless given. */
    readonly createWorker?: () => Worker;
}

/** What {@link createFindRunner} gives. */
export interface FindRunner {
    /** Searches, superseding any search still running: its answer is dropped. */
    search(search: FindSearch): void;
    dispose(): void;
}

const BUDGET = 1500;

/**
 * Runs searches in a worker, as a pattern the reader types can take exponential time and a `RegExp` can't be stopped on
 * the thread it runs on: a search past its budget terminates the worker, and the next search starts a new one. The worker
 * answers in order, so a search sent behind a hung one would wait for it: when the hung one is stopped, the latest is
 * sent again to the new worker. No Vue here: a composable wraps it and debounces typing.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createFindRunner(options: FindRunnerOptions): FindRunner {
    const { onChange, budget = BUDGET, createWorker = startFindWorker } = options;
    /** Searches the worker hasn't answered yet, by their sequence numbers, with their budget's timer. */
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    let worker: Worker | null = null;
    let sequence = 0;
    /** The search whose answer is wanted, `null` when the latest needs none. */
    let wanted: FindRequest | null = null;
    let matches: DiffMatches | null = null;

    return { search, dispose };

    function search({ lines, query, options: findOptions }: FindSearch) {
        sequence++;
        const expression = compileFindQuery(query, findOptions);
        if (expression === null || expression === 'invalid') {
            wanted = null;
            matches = null;
            onChange(expression === null ? { status: 'idle' } : { status: 'invalid' });
            return;
        }

        // Only what matching reads: a line's other fields would be copied to the worker for nothing.
        wanted = {
            sequence,
            lines: lines.map(({ text, counted }) => ({ text, counted })),
            source: expression.source,
            flags: expression.flags,
        };
        onChange({ status: 'searching', matches });
        send(wanted);
    }

    function dispose() {
        stopWorker();
        wanted = null;
    }

    function send(request: FindRequest) {
        worker ??= startWorker();
        worker.postMessage(request);
        timers.set(
            request.sequence,
            setTimeout(() => stopSearch(request.sequence), budget),
        );
    }

    function receive({ sequence: answered, matches: found }: FindResponse) {
        for (const [pending, timer] of timers) {
            if (pending <= answered) {
                clearTimeout(timer);
                timers.delete(pending);
            }
        }

        if (wanted?.sequence === answered) {
            wanted = null;
            matches = found;
            onChange({ status: 'done', matches: found });
        }
    }

    function stopSearch(stopped: number) {
        stopWorker();
        if (wanted === null) {
            return;
        }

        if (wanted.sequence === stopped) {
            wanted = null;
            matches = null;
            onChange({ status: 'tooSlow' });
        } else {
            // Queued behind the hung search, so never started: it gets its own budget on the new worker.
            send(wanted);
        }
    }

    function startWorker() {
        const started = createWorker();
        started.addEventListener('message', ({ data }: MessageEvent<FindResponse>) => receive(data));
        return started;
    }

    function stopWorker() {
        worker?.terminate();
        worker = null;
        for (const timer of timers.values()) {
            clearTimeout(timer);
        }

        timers.clear();
    }
}

function startFindWorker() {
    return new Worker(new URL('./find.worker.ts', import.meta.url), { type: 'module' });
}
