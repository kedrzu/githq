import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SavedSettingsOffer.stories.js';

const { Offer } = composeStories(stories);

test('names where the settings are, and only what they track', async () => {
    await Offer.run();

    await expect.element(page.getByRole('heading', { name: 'Load your saved settings?' })).toBeVisible();
    await expect
        .element(page.getByText('in the private repository mlaine/githq-settings', { exact: false }))
        .toBeVisible();
    await expect.element(page.getByRole('heading', { name: '6 repositories' })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: '3 projects' })).toBeVisible();
    await expect.element(page.getByText('fitloop/mobile')).toBeVisible();
    await expect.element(page.getByText('mlaine/blog')).not.toBeInTheDocument();
});

test(`⌘↵ and "Load these" load, once at a time; "No, I'll choose here" declines`, async () => {
    let settle = () => {};
    const load = vi.fn(
        () =>
            new Promise<void>(resolve => {
                settle = resolve;
            }),
    );
    const onDecline = vi.fn();
    await Offer.run({ args: { ...Offer.args, load, onDecline } });

    const button = page.getByRole('button', { name: 'Load these' });
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(load).toHaveBeenCalledOnce();
    settle();
    await expect.element(button).not.toHaveAttribute('aria-busy');

    await userEvent.click(page.getByRole('button', { name: "No, I'll choose here" }));
    expect(onDecline).toHaveBeenCalledOnce();
});
