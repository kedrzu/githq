import { assert } from '@nzyme/utils/assert.js';
import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './HeaderTabs.stories.js';
import type { HeaderTabsSet } from './HeaderTabs.vue';

const { Sections, SectionsCompact, SavedViews, SavedViewsCompact } = composeStories(stories);

test("a section's tooltip says where it goes, with its key, on hover and on keyboard focus", async () => {
    await Sections.run();

    const sections = page.getByRole('group', { name: 'Sections' });
    const issues = sections.getByRole('button', { name: 'Issues 0' });
    const pullRequests = sections.getByRole('button', { name: 'Pull requests 15' });
    await expect.element(pullRequests).toHaveAttribute('aria-keyshortcuts', '2');

    await userEvent.hover(issues);
    await expect.element(issues).toHaveAccessibleDescription('Go to issues1');
    await userEvent.unhover(issues);

    await userEvent.keyboard('{Tab}');
    await expect.element(pullRequests).toHaveFocus();
    await expect.element(pullRequests).toHaveAccessibleDescription('Go to pull requests2');
});

test("a saved view's tab is a link with its key; its tooltip says where it goes with the key, and under it when GitHub answers it or it was changed here", async () => {
    await SavedViews.run();

    const views = page.getByRole('navigation', { name: 'Saved views' });
    const current = views.getByRole('link', { name: 'Current sprint' });
    const board = views.getByRole('link', { name: /Board/ });
    const next = views.getByRole('link', { name: /Next sprint/ });
    await expect.element(current).toHaveAttribute('aria-current', 'page');
    await expect.element(current).toHaveAttribute('href', '/views/1');
    await expect.element(board).toHaveAttribute('aria-keyshortcuts', '2');

    await userEvent.hover(board);
    await expect.element(board).toHaveAccessibleDescription(/^Go to Board\s*2\s*Changed here$/);
    await userEvent.hover(next);
    await expect.element(next).toHaveAccessibleDescription(/^Go to Next sprint\s*3\s*Answered by\sGitHub$/);
    await userEvent.hover(current);
    await expect.element(current).toHaveAccessibleDescription(/^Go to Current sprint\s*1$/);
});

test('compact: one button named by the group and the current tab; its menu lists every tab with its key, and choosing one switches', async () => {
    const choose = vi.fn();
    const tabs = SectionsCompact.args.tabs;
    assert(tabs?.kind === 'model');

    const chosen: HeaderTabsSet = { ...tabs, choose };
    await SectionsCompact.run({ args: { ...SectionsCompact.args, tabs: chosen } });

    await userEvent.click(page.getByRole('button', { name: 'Sections: Pull requests 15' }));
    const items = page.getByRole('menuitem');
    await expect
        .poll(() => items.elements().map(item => item.getAttribute('aria-keyshortcuts')))
        .toEqual(['1', '2', '3', '4']);
    await expect.element(page.getByRole('menuitem', { name: /Pull requests/ })).toHaveAttribute('aria-current', 'true');

    await userEvent.click(page.getByRole('menuitem', { name: /Commits/ }));
    expect(choose).toHaveBeenCalledWith('commits');
});

test('compact: [ and ] in the open menu step to the previous and next tab, wrapping around, and close it; its hint is no item', async () => {
    const choose = vi.fn();
    const tabs = SectionsCompact.args.tabs;
    assert(tabs?.kind === 'model');

    const chosen: HeaderTabsSet = { ...tabs, value: 'workflows', choose };
    await SectionsCompact.run({ args: { ...SectionsCompact.args, tabs: chosen } });

    const button = page.getByRole('button', { name: 'Sections: Workflows –' });
    await userEvent.click(button);
    await expect.element(page.getByRole('menu')).toHaveTextContent(/Previous \/ next section$/);
    expect(page.getByRole('menuitem').elements()).toHaveLength(4);
    await userEvent.keyboard(']');
    expect(choose).toHaveBeenLastCalledWith('issues');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(button);
    // `[[` is how user-event writes a literal `[`.
    await userEvent.keyboard('[[');
    expect(choose).toHaveBeenLastCalledWith('commits');
});

test("compact saved views: the menu lists each view's key, and a view's key goes to it", async () => {
    await SavedViewsCompact.run();

    await userEvent.click(page.getByRole('button', { name: 'Saved views: Current sprint' }));
    await expect
        .poll(() =>
            page
                .getByRole('menuitem')
                .elements()
                .map(item => item.getAttribute('aria-keyshortcuts')),
        )
        .toEqual(['1', '2', '3']);
    await expect.element(page.getByRole('menu')).toHaveTextContent(/Previous \/ next view$/);
});
