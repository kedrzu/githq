import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './TrackedListView.stories.jsx';

const { Repositories, Projects, BeforeListsRead, NothingTracked } = composeStories(stories);

const group = (owner: string) => page.getByRole('list', { name: owner, exact: true });
const row = (owner: string, name: string) => group(owner).getByRole('listitem').filter({ hasText: name });
/** The text of the selected row; `null` with none. */
const selected = () => document.querySelector('li[aria-current="true"]')?.textContent?.trim() ?? null;

// `\s`: the translations keep short words with the next one by no-break spaces.

test('G8: the head counts what is tracked and says what githq does with it, with "Track repositories A"', async () => {
    await Repositories.run();

    await expect.element(page.getByRole('heading', { name: '7 tracked repositories', level: 2 })).toBeVisible();
    await expect
        .element(
            page.getByText(
                /^githq\skeeps\sa\sfull\scopy\sof\sthese\sin\sthis\sbrowser\sand\ssyncs\sit\sin\sthe\sbackground\.\sOpen\sone\sfor\sits\ssettings\.$/u,
            ),
        )
        .toBeVisible();
    await expect
        .element(page.getByRole('button', { name: 'Track repositories' }))
        .toHaveAttribute('aria-keyshortcuts', 'A');
});

test('G8: by owner, each header with how the user stands to it; "Track more" only where more can be tracked', async () => {
    await Repositories.run();

    await expect.element(page.getByRole('heading', { name: 'mlaine', level: 3 })).toBeVisible();
    await expect.element(page.getByText(/^your\srepositories\s·\s4\sof\s4\stracked$/u)).toBeVisible();
    await expect.element(page.getByText(/^organisation\s·\s2\sof\s312\stracked$/u)).toBeVisible();
    await expect.element(page.getByText(/^not\sa\smember\s·\s1\stracked$/u)).toBeVisible();
    const headings = page.getByRole('heading', { level: 3 }).elements();
    expect(headings.map(heading => heading.textContent)).toEqual(['mlaine', 'fitloop', 'nuxt']);
    await expect.element(page.getByRole('button', { name: 'Track more' })).toHaveLength(1);
});

test("G8: a row shows the repository's name without its owner, public or private, its open items and sync", async () => {
    await Repositories.run();

    const webapp = row('fitloop', 'webapp');
    await expect.element(webapp).toHaveTextContent(/^webapp\s*private\s*142\sopen\s*synced\s14s\sago/u);
    await expect.element(row('mlaine', 'tasklet')).toHaveTextContent(/tasklet\s*public\s*18\sopen/u);
    expect(webapp.element().getBoundingClientRect().height).toBe(36);

    // Untrack shows on the hovered and the selected row only.
    const untrack = webapp.getByRole('button', { name: 'Untrack', includeHidden: true });
    // An earlier test may have left the pointer where this row is drawn.
    await userEvent.hover(page.getByRole('heading', { name: 'fitloop', level: 3 }));
    expect(getComputedStyle(untrack.element()).visibility).toBe('hidden');
    await userEvent.hover(webapp);
    expect(getComputedStyle(untrack.element()).visibility).toBe('visible');
});

test("T17: where a project's items come from, how many items, how it stands", async () => {
    await Projects.run();

    await expect.element(page.getByRole('heading', { name: '4 tracked projects', level: 2 })).toBeVisible();
    await expect
        .element(
            page.getByText(
                /^githq\skeeps\severy\sitem\sof\sthese,\sfrom\sany\srepository,\sin\sthis\sbrowser\sand\ssyncs\sit\sin\sthe\sbackground\.\sOpen\sone\sfor\sits\ssettings\.$/u,
            ),
        )
        .toBeVisible();
    await expect.element(page.getByText(/^your\sprojects\s·\s1\sof\s1\stracked$/u)).toBeVisible();
    await expect.element(page.getByText(/^organisation\s·\s3\sof\s6\stracked$/u)).toBeVisible();
    await expect
        .element(row('mlaine', 'tasklet Roadmap'))
        .toHaveTextContent(/tasklet\sRoadmap\s*#1\s*from\smlaine\/tasklet\s*34\sitems\s*synced\s14s\sago/u);
    await expect
        .element(row('fitloop', 'Platform Q4'))
        .toHaveTextContent(/#12\s*from\s4\srepositories,\s2\stracked\s*128\sitems/u);
    await expect.element(row('fitloop', 'Ideas')).toHaveTextContent(/#14\s*drafts\sonly\s*3\sitems/u);
    await expect.element(page.getByRole('button', { name: 'Track projects' })).toBeVisible();
});

test("before GitHub's lists are read the tracked rows already show, counted without totals or Track more", async () => {
    await BeforeListsRead.run();

    await expect.element(page.getByText(/^your\srepositories\s·\s4\stracked$/u)).toBeVisible();
    await expect.element(page.getByText(/^1\stracked$/u)).toBeVisible();
    await expect.element(row('fitloop', 'webapp')).toBeVisible();
    // Nothing tells whether it is private: no tag.
    await expect.element(row('fitloop', 'webapp')).not.toHaveTextContent(/private|public/u);
    await expect.element(page.getByRole('button', { name: 'Track more' })).not.toBeInTheDocument();
});

test('nothing tracked: the head with its count and button', async () => {
    await NothingTracked.run();

    await expect.element(page.getByRole('heading', { name: '0 tracked repositories', level: 2 })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Track repositories' })).toBeVisible();
    await expect.element(page.getByRole('listitem')).not.toBeInTheDocument();
});

test('J/K and ↑/↓ move the selection, Enter opens the selected row, a click opens a row', async () => {
    const onOpen = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onOpen } });

    await userEvent.keyboard('j');
    await expect.poll(selected).toMatch(/^advent-2025/u);
    await userEvent.keyboard('j');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(selected).toMatch(/^notes/u);
    await userEvent.keyboard('k');
    await expect.poll(selected).toMatch(/^blog/u);
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowUp}');
    await expect.poll(selected).toMatch(/^advent-2025/u);

    // Across groups.
    for (let index = 0; index < 4; index++) {
        await userEvent.keyboard('j');
    }

    await expect.poll(selected).toMatch(/^api/u);
    // Untrack is drawn on the selected row, with its key.
    await expect
        .element(row('fitloop', 'api').getByRole('button', { name: 'Untrack' }))
        .toHaveAttribute('aria-keyshortcuts', 'Backspace');

    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ nameWithOwner: 'fitloop/api' }));

    await userEvent.click(row('nuxt', 'nuxt'));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ nameWithOwner: 'nuxt/nuxt' }));
});

test('⌫ untracks the selected row and the selection moves to the next one, the previous one after the last', async () => {
    const onUntrack = vi.fn();
    const onOpen = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onUntrack, onOpen } });

    // fitloop/api.
    for (let index = 0; index < 5; index++) {
        await userEvent.keyboard('j');
    }

    await userEvent.keyboard('{Backspace}');
    expect(onUntrack).toHaveBeenCalledWith(expect.objectContaining({ nameWithOwner: 'fitloop/api' }));
    await expect.poll(selected).toMatch(/^webapp/u);

    // The last row: the selection goes back.
    await userEvent.keyboard('j');
    await expect.poll(selected).toMatch(/^nuxt/u);
    await userEvent.keyboard('{Backspace}');
    await expect.poll(selected).toMatch(/^webapp/u);

    // Untrack on a row's button: untracks, doesn't open.
    await userEvent.hover(row('mlaine', 'blog'));
    await userEvent.click(row('mlaine', 'blog').getByRole('button', { name: 'Untrack' }));
    expect(onUntrack).toHaveBeenLastCalledWith(expect.objectContaining({ nameWithOwner: 'mlaine/blog' }));
    expect(onOpen).not.toHaveBeenCalled();
});

test('A and "Track repositories" open the picker; a group\'s "Track more" opens it on that owner', async () => {
    const onAdd = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onAdd } });

    await userEvent.keyboard('a');
    expect(onAdd).toHaveBeenLastCalledWith();
    await userEvent.click(page.getByRole('button', { name: 'Track repositories' }));
    expect(onAdd).toHaveBeenCalledTimes(2);
    await userEvent.click(page.getByRole('button', { name: 'Track more' }));
    expect(onAdd).toHaveBeenLastCalledWith('fitloop');
});

test('no key acts while a field has the focus or a layer is open', async () => {
    const onAdd = vi.fn();
    const onUntrack = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onAdd, onUntrack } });
    await userEvent.keyboard('j');

    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    await userEvent.keyboard('jaj{Backspace}');
    await expect.poll(selected).toMatch(/^advent-2025/u);
    expect(onAdd).not.toHaveBeenCalled();
    expect(onUntrack).not.toHaveBeenCalled();
    field.remove();

    // A layer (the picker, the command menu) has the keys.
    const layer = document.createElement('div');
    layer.dataset.layer = '';
    layer.dataset.noCommands = '';
    layer.tabIndex = -1;
    document.body.append(layer);
    layer.focus();
    await userEvent.keyboard('ja{Backspace}');
    await expect.poll(selected).toMatch(/^advent-2025/u);
    expect(onAdd).not.toHaveBeenCalled();
    expect(onUntrack).not.toHaveBeenCalled();
    layer.remove();
});
