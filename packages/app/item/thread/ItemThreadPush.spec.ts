import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ItemThreadPush.stories.js';

const { NoAccount, OnPhone, SixCommits, Wide } = composeStories(stories);

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

test('at the thread\'s widest the time follows "pushed 3 commits" and each commit\'s hash its message, nothing at the far edge', async () => {
    await Wide.run();
    const frame = page.getByTestId('frame').element().getBoundingClientRect();

    const time = document.querySelector('time');
    const what = time?.previousElementSibling?.getBoundingClientRect();
    if (!time || !what) {
        throw new Error('The head has no time after what was pushed.');
    }

    expect(time.getBoundingClientRect().left - what.right).toBeCloseTo(6, 0);
    expect(time.getBoundingClientRect().right).toBeLessThan(frame.right - 300);

    const hashes = page.getByRole('link', { name: /^[0-9a-f]{7}$/u }).elements();
    expect(hashes).toHaveLength(3);
    for (const hash of hashes) {
        const message = hash.parentElement?.querySelector('span')?.getBoundingClientRect();
        const before = hash.previousElementSibling?.getBoundingClientRect();
        const last = before && before.width > 0 ? before : message;
        if (!last) {
            throw new Error('The commit has no message before its hash.');
        }

        expect(hash.getBoundingClientRect().left - last.right).toBeCloseTo(8, 0);
        expect(hash.getBoundingClientRect().right).toBeLessThan(frame.right - 300);
    }
});

test('mobile D11: on a phone a commit says it opens on github.com before it is tapped; on the computer it does not', async () => {
    await OnPhone.run();
    const link = page.getByRole('link', { name: 'e81f0a3' });
    await expect.element(link).toHaveAccessibleName(/^e81f0a3\sopens on\sgithub\.com$/u);
    await expect.element(link).toHaveAttribute('href', 'https://github.com/kedrzu/githq/pull/15/commits/e81f0a3');

    await Wide.run();
    await expect.element(page.getByRole('link', { name: 'e81f0a3' })).toHaveAccessibleName('e81f0a3');
});
