import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './ItemThreadEvent.stories.js';

const { NoPerson, IssueThread, OneKindMerged, IssueEvents, TheirOwnReviewRequest } = composeStories(stories);

test("a line no person made shows no avatar: a workflow's Status change names no one, failed checks name CI", async () => {
    await NoPerson.run();

    const status = page.getByText(/Status set to\sDone in\stasklet Roadmap by\sa\sproject workflow/u).element();
    const checks = page.getByText(/2\sof\s9\schecks failed on\se81f0a3: e2e, typecheck/u).element();
    for (const line of [status, checks]) {
        expect(line.closest('p')?.querySelector('[data-initials], img')).toBeNull();
    }

    expect(status.closest('p')?.textContent?.trim()).toMatch(/^Status set to/u);
    expect(checks.closest('p')?.textContent?.trim()).toMatch(/^CI\s*2\sof\s9\schecks/u);
});

test('a burst reads as one line, and the user assigning themselves reads as such', async () => {
    await IssueThread.run();

    await expect.element(page.getByText(/and set the type to\sBug/u)).toBeVisible();
    await expect.element(page.getByText('self-assigned this')).toBeVisible();
});

test('the person asking for their own review, or taking the request back, reads as such', async () => {
    await TheirOwnReviewRequest.run();

    await expect.element(page.getByText('requested their own review', { exact: true })).toBeVisible();
    await expect.element(page.getByText('removed their review request', { exact: true })).toBeVisible();
});

test('events of one kind in a burst merge their objects, named by their references alone', async () => {
    await OneKindMerged.run();

    const what = page.getByText(/^mentioned this in/u).element();
    expect(what.textContent?.replace(/\s+/gu, ' ')).toBe(
        'mentioned this in #14, #15, and #16 and added sub-issues #14, #15, and #16 and referenced this in commits 4a1c9e2 and 7d3b0f5',
    );
});

test('an issue closed as a duplicate of one GitHub does not name says it is a duplicate all the same', async () => {
    await IssueEvents.run();

    await expect.element(page.getByText(/^closed this as\sa\sduplicate$/u)).toBeVisible();
});
