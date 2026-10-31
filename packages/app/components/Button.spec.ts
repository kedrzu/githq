import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Button.stories.jsx';

const { AsyncClick, Submit } = composeStories(stories);

test('runs its async action once however often it is activated meanwhile, then again once it settles', async () => {
    await AsyncClick.run();

    const track = page.getByRole('button', { name: 'Track these', exact: true });
    const runs = page.getByTestId('runs');

    await userEvent.dblClick(track);
    // Busy: marked for assistive technology, and "Working…" joins its name.
    const busyTrack = page.getByRole('button', { name: 'Track these Working…' });
    await expect.element(busyTrack).toHaveAttribute('aria-busy', 'true');
    await expect.element(runs).toHaveTextContent('Runs: 1');

    // Enter on the busy button does nothing either.
    busyTrack.element().focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(busyTrack);
    await expect.element(runs).toHaveTextContent('Runs: 1');

    await userEvent.click(page.getByRole('button', { name: 'Finish' }));
    await expect.element(track).not.toHaveAttribute('aria-busy');

    track.element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(runs).toHaveTextContent('Runs: 2');
});

test('a submit button submits its form once while the submission runs', async () => {
    await Submit.run();

    const create = page.getByRole('button', { name: 'Create issue', exact: true });
    await userEvent.dblClick(create);
    await expect
        .element(page.getByRole('button', { name: 'Create issue Working…' }))
        .toHaveAttribute('aria-busy', 'true');
    await expect.element(page.getByTestId('submits')).toHaveTextContent('Submits: 1');

    await userEvent.click(page.getByRole('button', { name: 'Finish' }));
    await expect.element(create).not.toHaveAttribute('aria-busy');
    await userEvent.click(create);
    await expect.element(page.getByTestId('submits')).toHaveTextContent('Submits: 2');
});
