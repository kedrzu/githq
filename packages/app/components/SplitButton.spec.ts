import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SplitButton.stories.jsx';

const { CloseIssue } = composeStories(stories);

test('the button does the usual action; the chevron is a target of its own and opens the other ways', async () => {
    await CloseIssue.run();

    const done = page.getByTestId('done');
    const chevron = page.getByRole('button', { name: 'More ways to close' });
    await userEvent.click(chevron);
    await userEvent.click(page.getByRole('menuitem', { name: 'Close as not planned' }));
    await expect.element(done).toHaveTextContent('Closed as: not planned');

    await userEvent.click(page.getByRole('button', { name: 'Close issue' }));
    await expect.element(done).toHaveTextContent('Closed as: completed');
});

test('reads as one joined control: a square joined end, the chevron as tall as the button', async () => {
    await CloseIssue.run();

    const main = page.getByRole('button', { name: 'Close issue' }).element();
    const chevron = page.getByRole('button', { name: 'More ways to close' }).element();
    expect(main.getBoundingClientRect().height).toBe(32);
    expect(chevron.getBoundingClientRect().height).toBe(32);
    expect(chevron.getBoundingClientRect().left).toBe(main.getBoundingClientRect().right);
    expect(getComputedStyle(main).borderTopRightRadius).toBe('0px');
    expect(getComputedStyle(main).borderRightWidth).toBe('0px');
    expect(getComputedStyle(chevron, '::before').height).toBe('16px');
    expect(main.getAttribute('data-button-size')).toBe('md');
    expect(chevron.getAttribute('data-button-size')).toBe('split');
});
