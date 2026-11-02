import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';
import { SAMPLE_WORKFLOWS } from '@/testing/sampleWorkflows.js';

import * as stories from './RunStrip.stories.js';

const { BrokenNew, BrokenOld, FewerRuns, NoRuns, RunningAfterFailures } = composeStories(stories);

// The heights of the design's ticks (W0): the verdict reads without colour.
const HEIGHT = { failed: 14, failedNew: 14, passed: 5, none: 2, running: 14, unknown: 1 };

test('a tick’s height carries its verdict: failed tall, passed short, no verdict a dash', async () => {
    await BrokenOld.run();

    expect(readTicks()).toEqual([
        { kind: 'passed', height: HEIGHT.passed },
        { kind: 'passed', height: HEIGHT.passed },
        { kind: 'failed', height: HEIGHT.failed },
        { kind: 'none', height: HEIGHT.none },
        { kind: 'failed', height: HEIGHT.failed },
    ]);
});

test('a break younger than a day is bright; a run going is a tall hollow tick, at the right', async () => {
    await BrokenNew.run();
    expect(readTicks().map(tick => tick.kind)).toEqual(['passed', 'passed', 'failedNew', 'failedNew', 'failedNew']);

    await RunningAfterFailures.run();
    const ticks = readTicks();
    expect(ticks.at(-1)).toEqual({ kind: 'running', height: HEIGHT.running });
    const bars = page.getByTestId('run-bar').elements();
    const running = bars.at(-1);
    expect(running && getComputedStyle(running).backgroundColor).toBe('rgba(0, 0, 0, 0)');
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
    const latest = SAMPLE_WORKFLOWS.lint.lastRuns.at(-1);
    expect(page.getByTestId('run-bar').elements().at(-1)?.closest('a')?.href).toBe(latest?.htmlUrl);
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

test('hovering a tick names the run: its number, ref and time; clicking opens it on GitHub', async () => {
    await BrokenOld.run();

    const tick = page.getByTestId('run-bar').elements().at(-1)?.closest('a');
    expect(tick?.title).toMatch(/^#204\s·\sv0\.2\.0-rc\.3\s·\sOct\s\d+,\s\d\d:\d\d$/);
    expect(tick?.href).toBe(SAMPLE_WORKFLOWS.release.lastRuns.at(-1)?.htmlUrl);
    expect(tick?.target).toBe('_blank');
});

/** The strip's ticks, left to right: their kind and their bar's height. */
function readTicks() {
    return page
        .getByTestId('run-bar')
        .elements()
        .map(bar => ({ kind: bar.dataset.kind, height: bar.getBoundingClientRect().height }));
}
