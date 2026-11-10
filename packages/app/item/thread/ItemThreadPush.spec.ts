import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ItemThreadPush.stories.js';

const { SixCommits, NoAccount } = composeStories(stories);

test('"Show 3 more commits" shows the rest in place and gives the focus to the first of them', async () => {
    await SixCommits.run();

    expect(page.getByRole('listitem').elements()).toHaveLength(3);
    await userEvent.click(page.getByRole('button', { name: 'Show 3 more commits' }));

    expect(page.getByRole('listitem').elements()).toHaveLength(6);
    await expect.element(page.getByRole('link', { name: '2b9e4c1' })).toHaveFocus();
    expect(page.getByRole('button', { name: /more commits/ }).query()).toBeNull();
});

test('commits of an author with no GitHub account are under the name git records, with no avatar', async () => {
    await NoAccount.run();

    const line = page.getByText('pushed 3 commits').element().closest('p');
    expect(line?.textContent).toContain('Maja Laine');
    expect(line?.querySelector('[data-initials], img')).toBeNull();
});
