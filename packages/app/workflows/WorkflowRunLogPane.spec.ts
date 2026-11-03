import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './WorkflowRunLogPane.stories.js';

const { Failed, GonePastRetention, Loading, LoadingNoJob, Ready, ReadyNoMarker, Running, Skipped, Waiting } =
    composeStories(stories);

const keys = page.getByTestId('workflow-log-keys');

beforeEach(() => {
    localStorage.removeItem('githq.logWrap');
    localStorage.removeItem('githq.logTimes');
});

test.each([
    ['W4e', LoadingNoJob],
    ['W4e, the job known', Loading],
    ['W4g', GonePastRetention],
    ['W4i', Failed],
    ['W4j', Running],
    ['W4j, waiting', Waiting],
    ['a skipped job', Skipped],
])('%s: W and T work and their toggles are there, with no log to apply them to yet', async (_, story) => {
    await story.run();

    const wrap = page.getByTestId('workflow-log-wrap');
    const times = page.getByTestId('workflow-log-times');
    await expect.element(wrap).toHaveAttribute('aria-pressed', 'false');
    await expect.element(times).toHaveAttribute('aria-pressed', 'false');

    await userEvent.keyboard('w');
    await expect.element(wrap).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('githq.logWrap')).toBe('true');
    await userEvent.keyboard('t');
    await expect.element(times).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('githq.logTimes')).toBe('true');
});

test('W4i: a toggle clicked gives the keys back, so that Enter doesn’t press it again', async () => {
    await Failed.run();
    const wrap = page.getByTestId('workflow-log-wrap');

    await userEvent.click(wrap);
    await expect.element(wrap).toHaveAttribute('aria-pressed', 'true');
    expect(document.activeElement).not.toBe(wrap.element());
});

test('W4a: every key of the log along the bottom', async () => {
    await Ready.run();

    await expect.element(keys).toHaveTextContent(/Line/u);
    await expect.element(keys).toHaveTextContent(/Step/u);
    await expect.element(keys).toHaveTextContent(/Job/u);
    await expect.element(keys).toHaveTextContent(/Error/u);
    await expect.element(keys).toHaveTextContent(/Fold/u);
    await expect.element(keys).toHaveTextContent(/GitHub/u);
    await expect.element(keys).toHaveTextContent(/All keys/u);
});

test('W4h: no error marker: no key for errors, the others as ever', async () => {
    await ReadyNoMarker.run();

    await expect.element(keys).toHaveTextContent(/Line/u);
    await expect.element(keys).toHaveTextContent(/Fold/u);
    await expect.element(keys).not.toHaveTextContent(/Error/u);
});

test('W4g: no row of keys', async () => {
    await GonePastRetention.run();

    await expect.element(page.getByRole('heading', { name: 'This log was garbage-collected' })).toBeVisible();
    await expect.element(keys).not.toBeInTheDocument();
});

test('W4i: Enter tries again, and the way to the other jobs', async () => {
    await Failed.run();

    await expect.element(keys).toHaveTextContent(/Try again/u);
    await expect.element(keys).toHaveTextContent(/Job/u);
    await expect.element(keys).not.toHaveTextContent(/Line/u);
});

test('W4e and W4j: only what works without a log', async () => {
    for (const story of [Loading, Running]) {
        await story.run();
        await expect.element(keys).toHaveTextContent(/Job/u);
        await expect.element(keys).toHaveTextContent(/GitHub/u);
        await expect.element(keys).not.toHaveTextContent(/Line|Fold|Try again/u);
    }
});
