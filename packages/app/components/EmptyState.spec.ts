import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './EmptyState.stories.jsx';

const { BrokenWithFactAndActions, Muted } = composeStories(stories);

/** `$color-red` in `tokens.scss`. */
const RED = 'rgb(248, 81, 73)';

test('a screen says its title as a heading, a broken one in red, its fact in a mono chip and its actions with their keys', async () => {
    await BrokenWithFactAndActions.run();

    const heading = page.getByRole('heading', { name: 'Actions are switched off' });
    await expect.element(heading).toBeVisible();
    expect(heading.element().tagName).toBe('H2');

    // The icon leads the note, before its copy (the heading and its line).
    const icon = heading.element().parentElement?.previousElementSibling;
    expect(icon && getComputedStyle(icon).color).toBe(RED);

    const fact = page.getByText('GET /repos/fitloop/webapp/actions/runs → 403');
    await expect.element(fact).toBeVisible();
    expect(getComputedStyle(fact.element()).fontFamily).toContain('JetBrains Mono');

    await expect.element(page.getByRole('button', { name: 'Try again' })).toHaveAttribute('aria-keyshortcuts', 'R');
});

test('without a fact no chip is drawn', async () => {
    await Muted.run();

    const heading = page.getByRole('heading', { name: 'No issues' });
    await expect.element(heading).toBeVisible();
    // The note: the icon, its copy, a fact and actions when given.
    const note = heading.element().parentElement?.parentElement;
    expect(note?.children).toHaveLength(2);
    expect(note?.querySelector('code')).toBeNull();
});
