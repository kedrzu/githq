import { assertValue } from '@nzyme/utils/assert.js';
import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';
import { sampleWorkflowState } from '@/testing/sampleWorkflows.js';

import * as stories from './WorkflowRow.stories.js';

const {
    BrokenNew,
    BrokenOld,
    ByGitHub,
    Cancelled,
    CrossRepository,
    Disabled,
    FailingOnNoRef,
    FewerRuns,
    NoRuns,
    Passing,
    RepositoryTab,
    RunningAfterFailures,
    WithRepository,
} = composeStories(stories);

test('the row is a button reached by Tab, named by the workflow, described by how it stands; Enter and a click open it', async () => {
    const open = vi.fn();
    await BrokenNew.run({ args: { ...BrokenNew.args, onOpen: open } });

    await userEvent.tab();
    const row = page.getByRole('button', { name: 'Deploy' });
    await expect.element(row).toHaveFocus();
    await expect.element(row).toHaveAccessibleDescription(matchText('Broken for 3h failed 14m ago'));

    await userEvent.keyboard('{Enter}');
    expect(open).toHaveBeenCalledTimes(1);

    // Anywhere on the row: the button stretches over it. Forced past Playwright's check, which sees the button on top
    // of the text — the point of it.
    await userEvent.click(page.getByText('failed 14m ago'), { force: true });
    expect(open).toHaveBeenCalledTimes(2);
});

test('a run under a minute old reads "just now", never "now ago"', async () => {
    const workflow = sampleWorkflowState({
        id: 1,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', ago: '30h' },
            { conclusion: 'failure', ago: '14m' },
        ],
    });
    const failedAt = assertValue(workflow.breakStartedAt);

    await BrokenNew.run({ args: { ...BrokenNew.args, workflow, now: failedAt + 10_000 } });

    await expect.element(page.getByText('failed just now')).toBeVisible();
    await expect.element(page.getByText('Broke just now')).toBeVisible();
});

test('a failure on no named ref says so in words, with no ref', async () => {
    await FailingOnNoRef.run();
    await expect.element(page.getByText('Failing without alerts')).toBeVisible();
});

test('a generated workflow says "by GitHub" in its name', async () => {
    await ByGitHub.run();
    await expect.element(page.getByRole('button', { name: matchText('Dependabot Updates by GitHub') })).toBeVisible();
});

test.each([
    ['broken for hours', BrokenNew, 'Broken for 3h', 'failed 14m ago'],
    ['broken for days', BrokenOld, 'Broken for 4 days', /^failed\sOct\s(29|30)$/],
    [
        'broken longer than the runs known, a run going',
        RunningAfterFailures,
        'Broken for 4+ days · #204 running 2m',
        'failed 23h ago',
    ],
    ['broken for weeks', ByGitHub, 'Broken for 3+ weeks', /^failed\sOct\s(30|31)$/],
    ['passing, a run going', Passing, 'Passing · #204 running 1m', 'passed 11m ago'],
    ['passing after a cancelled run', Cancelled, 'Passing', 'passed 14m ago'],
    ['healed', FewerRuns, 'Passing', /^passed\sNov\s(1|2)$/],
    ['disabled', Disabled, 'Disabled on GitHub', /^last\sran\sAug\s(12|13|14)$/],
    ['never run', NoRuns, 'No verdict yet', null],
] as const)('%s: says how it stands and its last result', async (_name, story, status, result) => {
    await story.run();

    await expect.element(page.getByText(matchText(status))).toBeVisible();
    if (result === null) {
        await expect.element(page.getByRole('button')).toHaveAccessibleDescription(matchText(status));
    } else {
        await expect.element(page.getByText(typeof result === 'string' ? matchText(result) : result)).toBeVisible();
    }
});

test('the repository is named on the cross-repository screen, with the patterns it is also broken on', async () => {
    await WithRepository.run();
    await expect.element(page.getByText('fitloop/webapp')).toBeVisible();
    await expect.element(page.getByText('+2')).toBeVisible();
});

test.each([
    ['across repositories', CrossRepository],
    ['in a repository’s tab', RepositoryTab],
])('%s every row’s latest run sits in one column', async (_name, story) => {
    await story.run();

    const strips = page.getByTestId('run-strip').elements();
    expect(strips.length).toBeGreaterThan(3);
    const rights = new Set(strips.map(strip => strip.getBoundingClientRect().right));
    expect(rights.size).toBe(1);
});
