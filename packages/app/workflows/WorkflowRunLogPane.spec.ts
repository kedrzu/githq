import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './WorkflowRunLogPane.stories.js';

const {
    Failed,
    GonePastRetention,
    Loading,
    LoadingNoJob,
    Ready,
    ReadyNoMarker,
    Refused,
    Running,
    Searching,
    Skipped,
    TooLarge,
    Waiting,
} = composeStories(stories);

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

test('a log too big to open says so and offers GitHub, no second try that would read it all again', async () => {
    await TooLarge.run();

    await expect.element(page.getByRole('heading', { name: 'The log of build is too big to open here' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Open on GitHub/u })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Try again/u })).not.toBeInTheDocument();
    await expect.element(keys).not.toHaveTextContent(/Try again/u);
    await expect.element(page.getByText(/didn't answer/u)).not.toBeInTheDocument();
});

test('a log the app refused says the app did, not GitHub, and can be tried again', async () => {
    await Refused.run();

    await expect.element(page.getByText(/githq refused this log/u)).toBeVisible();
    await expect.element(page.getByText(/didn't answer/u)).not.toBeInTheDocument();
    await expect.element(page.getByText('GET …/jobs/103/logs → refused by githq')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Try again/u })).toBeVisible();
    await expect.element(keys).toHaveTextContent(/Try again/u);
});

test('W4b: the keys for the next match follow the focus: N types in the field, so there it is ↵ and ⇧↵', async () => {
    await Searching.run();
    const field = page.getByTestId('workflow-log-search-field');
    const hintOf = (label: string) =>
        [...keys.element().children].find(hint => hint.textContent?.includes(label))?.querySelectorAll('svg').length;

    // Out of the field: letters.
    await expect.element(keys).toHaveTextContent(/N.*Next match/u);
    await expect.element(keys).toHaveTextContent(/N.*Previous/u);
    expect(hintOf('Next match')).toBe(0);

    await userEvent.keyboard('/');
    await expect.element(field).toHaveFocus();
    await expect.poll(() => hintOf('Next match')).toBe(1);
    expect(hintOf('Previous')).toBe(2);
    await expect.element(keys).not.toHaveTextContent(/N.*Next match/u);

    // Enter keeps the caret in the field, and the hints with it.
    await userEvent.keyboard('{Enter}');
    await expect.element(field).toHaveFocus();
    expect(hintOf('Next match')).toBe(1);

    page.getByTestId('workflow-job-log').element().focus();
    await expect.poll(() => hintOf('Next match')).toBe(0);
    await expect.element(keys).toHaveTextContent(/N.*Next match/u);

    // The bar goes with the focus in it: no hint left behind for a field that isn't there.
    await userEvent.keyboard('/');
    await expect.poll(() => hintOf('Next match')).toBe(1);
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByTestId('workflow-log-search')).not.toBeInTheDocument();
    await userEvent.keyboard('/');
    await expect.element(field).toHaveFocus();
    expect(hintOf('Next match')).toBe(1);
});

test('W4b, W4c: with the field focused the row keeps only what the field’s keys do, the letters typing there', async () => {
    await Searching.run();
    const field = page.getByTestId('workflow-log-search-field');
    const hints = () =>
        [...keys.element().children].map(hint => hint.textContent?.replaceAll(/\s+/gu, ' ').trim()).filter(Boolean);

    await userEvent.keyboard('/');
    await expect.element(field).toHaveFocus();
    await expect.poll(hints).toEqual(['Next match', 'Previous']);

    // Out of it, the row's all.
    page.getByTestId('workflow-job-log').element().focus();
    await expect.poll(() => hints().join()).toMatch(/Error.*Step.*Job.*Copy.*GitHub.*All keys/u);

    // Among only the matches: the same keys, Enter's being W4c's.
    await userEvent.keyboard('{Tab}');
    await expect.poll(() => hints().join()).toMatch(/Match.*Show in the full log.*Open gap.*Job.*GitHub.*All keys/u);
    await userEvent.keyboard('/');
    await expect.element(field).toHaveFocus();
    await expect.poll(hints).toEqual(['Show in the full log', 'Previous']);
});
