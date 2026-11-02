import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SavingView.stories.js';

const { Combining, CombiningNothingLost, Off, On, Stopped, TurnedOff, Unusable } = composeStories(stories);

const CHOICE = 'Save what I track to my GitHub account';

test('off, Space ticks the box, which asks GitHub first', async () => {
    const turnOn = vi.fn(() => Promise.resolve());
    await Off.run({ args: { ...Off.args, turnOn } });

    const choice = page.getByRole('checkbox', { name: CHOICE });
    await expect.element(choice).not.toBeChecked();
    await expect
        .element(page.getByText('githq creates a private repository named githq-settings', { exact: false }))
        .toBeVisible();

    choice.element().focus();
    await userEvent.keyboard(' ');
    expect(turnOn).toHaveBeenCalledOnce();
});

test('a repository found says what combining changes; ⌘↵ combines, Esc cancels', async () => {
    const combine = vi.fn(() => Promise.resolve());
    const onCancel = vi.fn();
    await Combining.run({ args: { ...Combining.args, combine, onCancel } });

    await expect.element(page.getByRole('checkbox', { name: CHOICE })).toBeChecked();
    await expect
        .element(
            page.getByRole('heading', {
                name: 'mlaine/githq-settings already exists, so it will be combined with this device',
            }),
        )
        .toBeVisible();
    await expect.element(page.getByTestId('saving-download')).toHaveTextContent('2 start tracking here and download');
    await expect.element(page.getByTestId('saving-download')).toHaveTextContent('fitloop/mobile, Docs revamp');
    await expect.element(page.getByTestId('saving-saved')).toHaveTextContent('1 is added to the saved settings');
    await expect
        .element(page.getByTestId('saving-untracked'))
        .toHaveTextContent('1 stops being tracked here, because the saved settings mark it untracked.');
    await expect.element(page.getByTestId('saving-untracked')).toHaveTextContent('acme/api · 1,240 items');

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(combine).toHaveBeenCalledOnce();
});

test('a group with nothing in it is not shown', async () => {
    await CombiningNothingLost.run();

    await expect.element(page.getByTestId('saving-download')).toBeVisible();
    await expect.element(page.getByTestId('saving-saved')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('saving-untracked')).not.toBeInTheDocument();
});

test('unticking a found repository cancels', async () => {
    const onCancel = vi.fn();
    await Combining.run({ args: { ...Combining.args, onCancel } });

    await userEvent.click(page.getByRole('checkbox', { name: CHOICE }));
    expect(onCancel).toHaveBeenCalledOnce();
});

test('while combining, the box cannot be unticked', async () => {
    const combine = vi.fn(() => new Promise<void>(() => {}));
    await Combining.run({ args: { ...Combining.args, combine } });

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(combine).toHaveBeenCalledOnce();
    await expect.element(page.getByRole('checkbox', { name: CHOICE })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
});

test('a file found while saving is no longer off: ⌘↵ and Esc do nothing', async () => {
    const combine = vi.fn(() => Promise.resolve());
    const onCancel = vi.fn();
    await Combining.run({ args: { ...Combining.args, saving: On.args.saving, combine, onCancel } });

    await expect.element(page.getByText('Saving what you track to your GitHub account')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(combine).not.toHaveBeenCalled();
});

test('a repository that cannot be used says why under the choice, still off', async () => {
    const turnOn = vi.fn(() => Promise.resolve());
    await Unusable.run({ args: { ...Unusable.args, turnOn } });

    await expect.element(page.getByRole('checkbox', { name: CHOICE })).not.toBeChecked();
    await expect.element(page.getByText('mlaine/githq-settings is public', { exact: false })).toBeVisible();
    await userEvent.keyboard('r');
    expect(turnOn).toHaveBeenCalledOnce();
});

test('on: the repository, when it last synced, what is saved; turning off asks nothing', async () => {
    const onTurnOff = vi.fn();
    await On.run({ args: { ...On.args, onTurnOff } });

    await expect.element(page.getByText('Saving what you track to your GitHub account')).toBeVisible();
    await expect
        .element(page.getByRole('link', { name: 'mlaine/githq-settings' }))
        .toHaveAttribute('href', 'https://github.com/mlaine/githq-settings');
    await expect.element(page.getByTestId('saving-synced')).toHaveTextContent('2 minutes ago');
    await expect.element(page.getByText('15 repositories, 3 projects. Views stay on this device.')).toBeVisible();
    await expect
        .element(page.getByRole('link', { name: 'Repository settings on GitHub' }))
        .toHaveAttribute('href', 'https://github.com/mlaine/githq-settings/settings');

    await userEvent.click(page.getByRole('button', { name: 'Turn off' }));
    expect(onTurnOff).toHaveBeenCalledOnce();
});

test('just turned off: the choice again, and the repository still there', async () => {
    await TurnedOff.run();

    await expect.element(page.getByRole('checkbox', { name: CHOICE })).not.toBeChecked();
    await expect
        .element(
            page.getByText(
                'Saving is off on this device. What you track here stayed, and mlaine/githq-settings is still in your account.',
            ),
        )
        .toBeVisible();
});

test('stopped: why, R tries again, and turning off is still there', async () => {
    const retry = vi.fn(() => Promise.resolve());
    const onTurnOff = vi.fn();
    await Stopped.run({ args: { ...Stopped.args, retry, onTurnOff } });

    await expect.element(page.getByRole('heading', { name: 'Syncing stopped' })).toBeVisible();
    await expect.element(page.getByTestId('saving-synced')).toHaveTextContent('3 hours ago');
    await userEvent.keyboard('r');
    expect(retry).toHaveBeenCalledOnce();
    await userEvent.click(page.getByRole('button', { name: 'Turn off' }));
    expect(onTurnOff).toHaveBeenCalledOnce();
});
