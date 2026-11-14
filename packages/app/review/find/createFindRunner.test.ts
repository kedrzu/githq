import { expect, test } from 'bun:test';

import type { FindOptions } from './compileFindQuery.js';
import { createFindRunner } from './createFindRunner.js';
import type { FindRunner, FindSearch, FindState } from './createFindRunner.js';
import type { FindLine } from './findDiffMatches.js';

const BUDGET = 300;
const PLAIN: FindOptions = { matchCase: false, wholeWord: false, regex: false };
const REGEX: FindOptions = { ...PLAIN, regex: true };
/** Exponential on a run of `a`s that ends in anything else; a line of only `a`s matches at once. */
const HUNG: FindSearch = { lines: linesOf(['a'.repeat(40) + '!']), query: '(a+)+$', options: REGEX };

test('searches in the worker, keeping the last matches while the next search runs', async () => {
    const { runner, states, next } = start();

    runner.search({ lines: linesOf(['foo', 'a foo']), query: 'foo', options: PLAIN });
    const first = await next('done');
    runner.search({ lines: linesOf(['foo', 'a foo']), query: 'a', options: PLAIN });
    await next('done');

    expect(first.status === 'done' && [...first.matches.lines]).toEqual([0, 1]);
    expect(states.map(state => state.status)).toEqual(['searching', 'done', 'searching', 'done']);
    expect(states[2]).toEqual({ status: 'searching', matches: first.status === 'done' ? first.matches : null });
    runner.dispose();
});

test('a newer search supersedes one in flight: only its answer is told', async () => {
    const { runner, states, next } = start();

    runner.search({ lines: linesOf(['foo bar']), query: 'foo', options: PLAIN });
    runner.search({ lines: linesOf(['foo bar']), query: 'bar', options: PLAIN });
    const done = await next('done');
    // Long enough for the first answer, had it not been dropped, to arrive after the second.
    await Bun.sleep(50);

    expect(done.status === 'done' && [...done.matches.starts]).toEqual([4]);
    expect(states.filter(state => state.status === 'done')).toHaveLength(1);
    runner.dispose();
});

test('a hung pattern is stopped within the budget, its worker ended, and the next search works', async () => {
    const { runner, next, terminated } = start();
    const started = performance.now();

    runner.search(HUNG);
    await next('tooSlow');
    const stoppedAfter = performance.now() - started;
    runner.search({ lines: linesOf(['foo']), query: 'foo', options: PLAIN });
    const done = await next('done');

    expect(stoppedAfter).toBeLessThan(BUDGET + 500);
    // A hung worker left running would spin a core for as long as the tab lives.
    expect(terminated).toEqual([0]);
    expect(done.status === 'done' && done.matches.lines.length).toBe(1);
    runner.dispose();
});

test('a search sent behind a hung one runs on a new worker once the hung one is stopped', async () => {
    const { runner, states, next } = start();

    runner.search(HUNG);
    runner.search({ lines: linesOf(['foo']), query: 'foo', options: PLAIN });
    const done = await next('done');

    expect(done.status === 'done' && done.matches.lines.length).toBe(1);
    expect(states.some(state => state.status === 'tooSlow')).toBe(false);
    runner.dispose();
});

test('an empty query is idle and a broken pattern invalid, and a search in flight is dropped', async () => {
    const { runner, states } = start();

    runner.search({ lines: linesOf(['foo']), query: 'foo', options: PLAIN });
    runner.search({ lines: linesOf(['foo']), query: '(', options: REGEX });
    runner.search({ lines: linesOf(['foo']), query: '', options: PLAIN });
    await Bun.sleep(100);

    expect(states.map(state => state.status)).toEqual(['searching', 'invalid', 'idle']);
    runner.dispose();
});

function start() {
    const states: FindState[] = [];
    const waiting: Array<() => void> = [];
    /** The workers ended, by the order they started in. */
    const terminated: number[] = [];
    let started = 0;
    const runner: FindRunner = createFindRunner({
        budget: BUDGET,
        createWorker: () => {
            const index = started++;
            const worker = new Worker(new URL('./find.worker.ts', import.meta.url), { type: 'module' });
            const terminate = worker.terminate.bind(worker);
            worker.terminate = () => {
                terminated.push(index);
                terminate();
            };
            return worker;
        },
        onChange: state => {
            states.push(state);
            for (const wake of waiting.splice(0)) {
                wake();
            }
        },
    });

    return { runner, states, next, terminated };

    /** The next state of this status from now on. */
    async function next(status: FindState['status']) {
        const from = states.length;
        while (!states.slice(from).some(state => state.status === status)) {
            await new Promise<void>(resolve => {
                waiting.push(resolve);
            });
        }

        return states.slice(from).find(state => state.status === status)!;
    }
}

function linesOf(texts: readonly string[]): FindLine[] {
    return texts.map(text => ({ text, counted: true }));
}
