import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './ItemThreadEvent.stories.js';

const { NoPerson, IssueThread } = composeStories(stories);

test('a line no person made names no one and shows no avatar: what GitHub tells is not put on someone', async () => {
    await NoPerson.run();

    const status = page.getByText(/Status set to\sDone in\stasklet Roadmap by\sa\sproject workflow/u).element();
    const checks = page.getByText(/2\sof\s9\schecks failed on\se81f0a3: e2e, typecheck/u).element();
    for (const line of [status, checks]) {
        const row = line.closest('p');
        expect(row?.querySelector('[data-initials], img')).toBeNull();
        expect(row?.textContent?.trim()).toMatch(/^(Status set to|2\sof\s9\schecks)/u);
    }
});

test('a burst reads as one line, and the user assigning themselves reads as such', async () => {
    await IssueThread.run();

    await expect.element(page.getByText(/and set the type to\sBug/u)).toBeVisible();
    await expect.element(page.getByText('self-assigned this')).toBeVisible();
});
