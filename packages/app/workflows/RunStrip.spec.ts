import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './RunStrip.stories.js';

const { BrokenNew, BrokenOld, FewerRuns, NoRuns, RunningAfterFailures } = composeStories(stories);

// The heights of the design's ticks (W0): the verdict reads without colour.
const HEIGHT = { failed: 14, passed: 5, unknown: 1 };

test('a break younger than a day is bright; a run going stands at the right', async () => {
    await BrokenNew.run();
    expect(readTicks().map(tick => tick.kind)).toEqual(['passed', 'passed', 'failedNew', 'failedNew', 'failedNew']);

    await RunningAfterFailures.run();
    expect(readTicks().at(-1)?.kind).toBe('running');
});

test('with fewer than five runs the slots on the left are hairlines and the latest run is the rightmost', async () => {
    await FewerRuns.run();

    expect(readTicks()).toEqual([
        { kind: 'unknown', height: HEIGHT.unknown },
        { kind: 'unknown', height: HEIGHT.unknown },
        { kind: 'unknown', height: HEIGHT.unknown },
        { kind: 'failed', height: HEIGHT.failed },
        { kind: 'passed', height: HEIGHT.passed },
    ]);
});

test('screen readers hear the runs in words, oldest first', async () => {
    await BrokenOld.run();
    await expect
        .element(page.getByText(matchText('Last 5 runs: passed, passed, failed, no verdict, failed')))
        .toBeInTheDocument();

    await RunningAfterFailures.run();
    await expect
        .element(page.getByText(matchText('Last 5 runs: failed, failed, failed, failed, running')))
        .toBeInTheDocument();

    await FewerRuns.run();
    await expect.element(page.getByText(matchText('Last 2 runs: failed, passed'))).toBeInTheDocument();

    await NoRuns.run();
    await expect.element(page.getByText(matchText('No runs known'))).toBeInTheDocument();
});

test('hovering a tick names the run: its number, ref and time; a tick is no link, so a click is the row’s', async () => {
    await BrokenOld.run();

    const bar = page.getByTestId('run-bar').elements().at(-1);
    expect(bar?.parentElement?.title).toMatch(/^#204\s·\sv0\.2\.0-rc\.3\s·\sOct\s\d+,\s\d\d:\d\d$/);
    expect(bar?.closest('a')).toBeNull();
});

/** The strip's ticks, left to right: their kind and their bar's height. */
function readTicks() {
    return page
        .getByTestId('run-bar')
        .elements()
        .map(bar => ({ kind: bar.dataset.kind, height: bar.getBoundingClientRect().height }));
}
