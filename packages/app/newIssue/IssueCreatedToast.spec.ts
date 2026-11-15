import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { holdToastLifetimes } from '@/testing/holdToastLifetimes.js';

import * as stories from './IssueCreatedToast.stories.jsx';

const { NumberOnItsWay, Numbered, OnPhone } = composeStories(stories);

const toast = () => page.getByRole('listitem');

test('the number is on its way until GitHub gives it', async () => {
    await holdToastLifetimes(() => NumberOnItsWay.run());
    await expect.element(toast()).toHaveTextContent('Waitlist ignores paused memberships · number on its way');

    await holdToastLifetimes(() => Numbered.run());
    await expect.element(toast()).toHaveTextContent('#1211 · Waitlist ignores paused memberships');
});

test('Create another and Open are buttons with no keys, and Escape stays the screen’s', async () => {
    await holdToastLifetimes(() => Numbered.run());

    const another = toast().getByRole('button', { name: 'Create another' });
    await expect.element(another).not.toHaveAttribute('aria-keyshortcuts');
    await userEvent.click(another);
    await expect.element(page.getByTestId('asked')).toHaveTextContent('Create another');

    await userEvent.click(toast().getByRole('button', { name: 'Open', exact: true }));
    await expect.element(page.getByTestId('asked')).toHaveTextContent('Open');

    await userEvent.keyboard('{Escape}');
    await expect.element(toast()).toBeVisible();
    expect(toast().getByRole('button', { name: 'Dismiss' }).elements()).toHaveLength(1);
});

test('on a phone its buttons are a finger’s height', async () => {
    await holdToastLifetimes(() => OnPhone.run());

    for (const name of ['Create another', 'Open']) {
        const button = toast().getByRole('button', { name, exact: true }).element();
        expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
});
