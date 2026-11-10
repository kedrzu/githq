import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './GitHubLinks.stories.js';

const { InItem, Links } = composeStories(stories);

test('a click on a githq link opens it in the app', async () => {
    await Links.run();

    await userEvent.click(page.getByRole('link', { name: 'a comment on #12' }));
    await expect.element(page.getByTestId('at')).toHaveTextContent('At: /acme/web/issues/12#issuecomment-5');
});

test('in an opened item, an item linked opens there', async () => {
    await InItem.run();

    await userEvent.click(page.getByRole('link', { name: '#15' }));
    await expect.element(page.getByTestId('opened')).toHaveTextContent('Opened: acme/web#15');
    await expect.element(page.getByTestId('at')).toHaveTextContent('At: /');
});

test('right-clicking a githq link opens a menu with Open and Open on GitHub', async () => {
    await Links.run();
    const link = page.getByRole('link', { name: '#15' });

    await userEvent.click(link, { button: 'right' });
    const items = page.getByRole('menu').getByRole('menuitem');
    await expect.element(items.first()).toHaveTextContent(/^\s*Open\s*$/);
    await expect.element(items.nth(1)).toHaveTextContent(/^\s*Open on GitHub\s*$/);
    expect(items.elements()).toHaveLength(2);

    await userEvent.click(page.getByRole('menuitem', { name: 'Open on GitHub' }));
    await expect
        .element(page.getByTestId('on-github'))
        .toHaveTextContent('On GitHub: https://github.com/acme/web/pull/15');
    await expect.element(page.getByTestId('at')).toHaveTextContent('At: /');

    await userEvent.click(link, { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Open', exact: true }));
    await expect.element(page.getByTestId('at')).toHaveTextContent('At: /acme/web/pull/15');
});

test('right-clicking the text or a link that stays GitHub’s opens no app menu', async () => {
    await Links.run();

    await userEvent.click(page.getByTestId('text'), { button: 'right' });
    await userEvent.click(page.getByRole('link', { name: '@octocat' }), { button: 'right' });
    // Given the time a menu takes to open.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    expect(document.querySelector('[role="menu"]')).toBeNull();

    // While on a githq link it does open.
    await userEvent.click(page.getByRole('link', { name: '#15' }), { button: 'right' });
    await expect.element(page.getByRole('menu')).toBeVisible();
});
