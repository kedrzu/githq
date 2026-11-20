import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './TrackedListView.stories.jsx';

const { Repositories, Projects, BeforeListsRead, NothingTracked, RepositoriesPhone, NothingTrackedPhone } =
    composeStories(stories);

const row = (name: string) => page.getByRole('listitem').filter({ hasText: name });
/** The text of the selected row; `null` with none. */
const selected = () => document.querySelector('li[aria-current="true"]')?.textContent?.trim() ?? null;
/** The rows' keys, in the page's order. */
const order = () =>
    [...document.querySelectorAll('li[data-tracked-key]')].map(item => item.getAttribute('data-tracked-key'));

/** The sample repositories, in the user's order the story starts from. */
const REPOSITORY_ORDER = [
    'mlaine/tasklet',
    'fitloop/webapp',
    'mlaine/blog',
    'fitloop/api',
    'mlaine/notes',
    'nuxt/nuxt',
    'mlaine/advent-2025',
];

// `\s`: the translations keep short words with the next one by no-break spaces.

test('G8: the head counts what is tracked and says what githq does with it, with "⌥↑ ⌥↓ Move" and "Track repositories A"', async () => {
    await Repositories.run();

    await expect.element(page.getByRole('heading', { name: '7 tracked repositories', level: 2 })).toBeVisible();
    await expect
        .element(
            page.getByText(
                /^githq\skeeps\sa\sfull\scopy\sof\sthese\sin\sthis\sbrowser\sand\ssyncs\sit\sin\sthe\sbackground\.\sOpen\sone\sfor\sits\ssettings\.$/u,
            ),
        )
        .toBeVisible();
    await expect.element(page.getByText('Move', { exact: true })).toBeVisible();
    await expect
        .element(page.getByRole('button', { name: 'Track repositories' }))
        .toHaveAttribute('aria-keyshortcuts', 'A');
});

test("G8 (D44): one flat list in the user's order, owners mixed, each row naming its owner before its name; no owner groups", async () => {
    await Repositories.run();

    expect(order()).toEqual(REPOSITORY_ORDER);
    await expect.element(page.getByRole('list', { name: 'Tracked repositories' })).toBeVisible();
    await expect.element(page.getByRole('heading', { level: 3 })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Track more' })).not.toBeInTheDocument();

    const webapp = row('fitloop/webapp');
    await expect.element(webapp).toHaveTextContent(/^fitloop\/webapp\s*private\s*142\sopen\s*synced\s14s\sago/u);
    await expect.element(row('mlaine/tasklet')).toHaveTextContent(/^mlaine\/tasklet\s*public\s*18\sopen/u);

    // Untrack shows on the hovered and the selected row only.
    const untrack = webapp.getByRole('button', { name: 'Untrack', includeHidden: true });
    // An earlier test may have left the pointer where this row is drawn.
    await userEvent.hover(page.getByRole('heading', { level: 2 }));
    expect(getComputedStyle(untrack.element()).visibility).toBe('hidden');
    await userEvent.hover(webapp);
    expect(getComputedStyle(untrack.element()).visibility).toBe('visible');
});

test("T17: a project's owner before its title, where its items come from, how many items, how it stands", async () => {
    await Projects.run();

    await expect.element(page.getByRole('heading', { name: '4 tracked projects', level: 2 })).toBeVisible();
    await expect
        .element(
            page.getByText(
                /^githq\skeeps\severy\sitem\sof\sthese,\sfrom\sany\srepository,\sin\sthis\sbrowser\sand\ssyncs\sit\sin\sthe\sbackground\.\sOpen\sone\sfor\sits\ssettings\.$/u,
            ),
        )
        .toBeVisible();
    expect(order()).toEqual(['PVT_12', 'PVT_1', 'PVT_9', 'PVT_14']);
    await expect
        .element(row('tasklet Roadmap'))
        .toHaveTextContent(
            /^mlaine\s\/\stasklet\sRoadmap\s*#1\s*from\smlaine\/tasklet\s*34\sitems\s*synced\s14s\sago/u,
        );
    await expect
        .element(row('Platform Q4'))
        .toHaveTextContent(/^fitloop\s\/\sPlatform\sQ4\s*#12\s*from\s4\srepositories,\s2\stracked\s*128\sitems/u);
    await expect.element(row('Ideas')).toHaveTextContent(/#14\s*drafts\sonly\s*3\sitems/u);
    await expect.element(page.getByRole('button', { name: 'Track projects' })).toBeVisible();
});

test("before GitHub's lists are read the tracked rows already show, without a tag where nothing tells", async () => {
    await BeforeListsRead.run();

    await expect.element(row('fitloop/webapp')).toBeVisible();
    await expect.element(row('fitloop/webapp')).not.toHaveTextContent(/private|public/u);
    await expect.element(row('mlaine/tasklet')).toHaveTextContent(/public/u);
});

test('ES24: nothing tracked: the note says what tracking does, and its button and A add the first', async () => {
    const onAdd = vi.fn();
    await NothingTracked.run({ args: { ...NothingTracked.args, onAdd } });

    await expect.element(page.getByRole('heading', { name: 'No repositories tracked yet', level: 2 })).toBeVisible();
    await expect.element(page.getByText(/^0\stracked/u)).not.toBeInTheDocument();
    await expect.element(page.getByRole('listitem')).not.toBeInTheDocument();

    await page.getByRole('button', { name: 'Track repositories' }).click();
    await userEvent.keyboard('a');
    expect(onAdd).toHaveBeenCalledTimes(2);
});

test('ES24: before what is tracked is known, nothing says none', async () => {
    await NothingTracked.run({ args: { ...NothingTracked.args, loaded: false } });

    await expect.element(page.getByRole('heading', { name: 'No repositories tracked yet' })).not.toBeInTheDocument();
});

test('ES24: no projects tracked has its own words', async () => {
    await NothingTracked.run({ args: { ...NothingTracked.args, kind: 'projects' } });

    await expect.element(page.getByRole('heading', { name: 'No projects tracked yet', level: 2 })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Track projects' })).toBeVisible();
});

test('J/K and ↑/↓ move the selection, Enter opens the selected row, a click opens a row', async () => {
    const onOpen = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onOpen } });

    await userEvent.keyboard('j');
    await expect.poll(selected).toMatch(/^mlaine\/tasklet/u);
    await userEvent.keyboard('j');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(selected).toMatch(/^mlaine\/blog/u);
    await userEvent.keyboard('k');
    await expect.poll(selected).toMatch(/^fitloop\/webapp/u);
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowUp}');
    await expect.poll(selected).toMatch(/^mlaine\/tasklet/u);

    for (let index = 0; index < 3; index++) {
        await userEvent.keyboard('j');
    }

    await expect.poll(selected).toMatch(/^fitloop\/api/u);
    // Untrack is drawn on the selected row, with its key.
    await expect
        .element(row('fitloop/api').getByRole('button', { name: 'Untrack' }))
        .toHaveAttribute('aria-keyshortcuts', 'Backspace');

    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ nameWithOwner: 'fitloop/api' }));

    await userEvent.click(row('nuxt/nuxt'));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ nameWithOwner: 'nuxt/nuxt' }));
});

test('⌫ untracks the selected row and the selection moves to the next one, the previous one after the last', async () => {
    const onUntrack = vi.fn();
    const onOpen = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onUntrack, onOpen } });

    // fitloop/api.
    for (let index = 0; index < 4; index++) {
        await userEvent.keyboard('j');
    }

    await userEvent.keyboard('{Backspace}');
    expect(onUntrack).toHaveBeenCalledWith(expect.objectContaining({ nameWithOwner: 'fitloop/api' }));
    await expect.poll(selected).toMatch(/^mlaine\/notes/u);
    // The untracked row is gone; the others keep their places.
    expect(order()).toEqual(REPOSITORY_ORDER.filter(name => name !== 'fitloop/api'));

    // The last row: the selection goes back.
    await userEvent.keyboard('j');
    await userEvent.keyboard('j');
    await expect.poll(selected).toMatch(/^mlaine\/advent-2025/u);
    await userEvent.keyboard('{Backspace}');
    await expect.poll(selected).toMatch(/^nuxt\/nuxt/u);

    // Untrack on a row's button: untracks, doesn't open.
    await userEvent.hover(row('mlaine/blog'));
    await userEvent.click(row('mlaine/blog').getByRole('button', { name: 'Untrack' }));
    expect(onUntrack).toHaveBeenLastCalledWith(expect.objectContaining({ nameWithOwner: 'mlaine/blog' }));
    expect(onOpen).not.toHaveBeenCalled();
});

test('D44: ⌥↓ moves the selected row after the next one, ⌥↑ before the previous one, the selection staying on it; nothing at the ends', async () => {
    const onMove = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onMove } });

    await userEvent.keyboard('jj');
    await expect.poll(selected).toMatch(/^fitloop\/webapp/u);

    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ nameWithOwner: 'fitloop/webapp' }), {
        anchor: expect.objectContaining({ nameWithOwner: 'mlaine/blog' }),
        side: 'after',
    });
    await expect.poll(order).toEqual(['mlaine/tasklet', 'mlaine/blog', 'fitloop/webapp', ...REPOSITORY_ORDER.slice(3)]);
    await expect.poll(selected).toMatch(/^fitloop\/webapp/u);

    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await expect.poll(order).toEqual(['mlaine/tasklet', 'fitloop/webapp', 'mlaine/blog', ...REPOSITORY_ORDER.slice(3)]);
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ nameWithOwner: 'fitloop/webapp' }), {
        anchor: expect.objectContaining({ nameWithOwner: 'mlaine/tasklet' }),
        side: 'before',
    });
    await expect.poll(order).toEqual(['fitloop/webapp', 'mlaine/tasklet', 'mlaine/blog', ...REPOSITORY_ORDER.slice(3)]);
    await expect.poll(selected).toMatch(/^fitloop\/webapp/u);

    // The first row goes no higher, the last no lower.
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    for (let index = 0; index < 6; index++) {
        await userEvent.keyboard('j');
    }

    await expect.poll(selected).toMatch(/^mlaine\/advent-2025/u);
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onMove).toHaveBeenCalledTimes(3);
});

test('D44: a row dragged down lands after the row it took the place of; the drag opens nothing', async () => {
    const onMove = vi.fn();
    const onOpen = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onMove, onOpen } });

    await dragRow('mlaine/tasklet', 'fitloop/api');
    expect(onMove).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ nameWithOwner: 'mlaine/tasklet' }), {
        anchor: expect.objectContaining({ nameWithOwner: 'fitloop/api' }),
        side: 'after',
    });
    // The list is Vue's, as the new order came back: Sortable's own move was put back.
    await expect
        .poll(order)
        .toEqual(['fitloop/webapp', 'mlaine/blog', 'fitloop/api', 'mlaine/tasklet', ...REPOSITORY_ORDER.slice(4)]);

    await new Promise(requestAnimationFrame);
    expect(onOpen).not.toHaveBeenCalled();
});

test('D44: a row dragged up lands before the row it took the place of, also after an earlier drop reordered the list', async () => {
    const onMove = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onMove } });

    await dragRow('mlaine/tasklet', 'fitloop/api');
    await expect
        .poll(order)
        .toEqual(['fitloop/webapp', 'mlaine/blog', 'fitloop/api', 'mlaine/tasklet', ...REPOSITORY_ORDER.slice(4)]);
    onMove.mockClear();

    // Told against the rows as they are now, not as the list first drew them.
    await dragRow('nuxt/nuxt', 'mlaine/blog');
    expect(onMove).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ nameWithOwner: 'nuxt/nuxt' }), {
        anchor: expect.objectContaining({ nameWithOwner: 'mlaine/blog' }),
        side: 'before',
    });
});

test('A and "Track repositories" open the picker', async () => {
    const onAdd = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onAdd } });

    await userEvent.keyboard('a');
    expect(onAdd).toHaveBeenLastCalledWith();
    await userEvent.click(page.getByRole('button', { name: 'Track repositories' }));
    expect(onAdd).toHaveBeenCalledTimes(2);
});

test('no key acts while a field has the focus or a layer is open', async () => {
    const onAdd = vi.fn();
    const onUntrack = vi.fn();
    const onMove = vi.fn();
    await Repositories.run({ args: { ...Repositories.args, onAdd, onUntrack, onMove } });
    await userEvent.keyboard('j');

    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    await userEvent.keyboard('jaj{Backspace}{Alt>}{ArrowDown}{/Alt}');
    await expect.poll(selected).toMatch(/^mlaine\/tasklet/u);
    expect(onAdd).not.toHaveBeenCalled();
    expect(onUntrack).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    field.remove();

    // A layer (the picker, the command menu) has the keys.
    const layer = document.createElement('div');
    layer.dataset.layer = '';
    layer.dataset.noCommands = '';
    layer.tabIndex = -1;
    document.body.append(layer);
    layer.focus();
    await userEvent.keyboard('ja{Backspace}{Alt>}{ArrowDown}{/Alt}');
    await expect.poll(selected).toMatch(/^mlaine\/tasklet/u);
    expect(onAdd).not.toHaveBeenCalled();
    expect(onUntrack).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    layer.remove();
});

test("on a wide screen a project row's source, count and sync follow its name 10px apart, while Untrack and the chevron stay at the row's edge", async () => {
    await page.viewport(1440, 900);
    onTestFinished(() => page.viewport(414, 896));
    await Projects.run();

    const title = page.getByText(/^fitloop\s\/\sPlatform\sQ4$/u).element();
    const rowBox = title.parentElement?.getBoundingClientRect();
    const number = title.nextElementSibling;
    const source = number?.nextElementSibling;
    const count = source?.nextElementSibling;
    const sync = count?.nextElementSibling;
    if (!rowBox || !number || !source || !count || !sync) {
        throw new Error('The row lacks its number, source, count or sync note.');
    }

    expect(source.getBoundingClientRect().left - number.getBoundingClientRect().right).toBeCloseTo(10, 0);
    expect(count.getBoundingClientRect().left - source.getBoundingClientRect().right).toBeCloseTo(10, 0);
    expect(sync.getBoundingClientRect().left - count.getBoundingClientRect().right).toBeCloseTo(10, 0);
    expect(sync.getBoundingClientRect().right).toBeLessThan(rowBox.right - 300);

    const actions = sync.nextElementSibling?.nextElementSibling?.getBoundingClientRect();
    expect(actions?.right).toBeCloseTo(rowBox.right - 12, 0);
});

test("MB151: on a phone one flat list in the user's order, each row one button drilling into its settings, with no Untrack nor the keys' hint", async () => {
    const onOpen = vi.fn();
    await RepositoriesPhone.run({ args: { ...RepositoriesPhone.args, onOpen } });

    expect(order()).toEqual(REPOSITORY_ORDER);
    await expect.element(page.getByRole('button', { name: /^Untrack/u })).not.toBeInTheDocument();
    await expect.element(page.getByText('Move', { exact: true })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: /^mlaine\/tasklet/u }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ nameWithOwner: 'mlaine/tasklet' }));
});

test("MB162: nothing tracked on a phone, the note's button adds the first", async () => {
    const onAdd = vi.fn();
    await NothingTrackedPhone.run({ args: { ...NothingTrackedPhone.args, onAdd } });

    await userEvent.click(page.getByRole('button', { name: 'Track repositories' }));
    expect(onAdd).toHaveBeenCalled();
});

/**
 * Drags a row onto another's, as a mouse does with Sortable's own pointer dragging: a frame between steps, a pause over
 * the target for Sortable to see it there, and on release the mouse's own `mouseup` (which Sortable drops on) and the
 * click the browser sends after it.
 */
async function dragRow(name: string, onto: string) {
    const source = row(name).element();
    const from = source.getBoundingClientRect();
    const to = row(onto).element().getBoundingClientRect();
    const x = from.left + 40;
    const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 };
    source.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x, clientY: from.top + from.height / 2 }));
    for (let step = 1; step <= 10; step++) {
        const y = from.top + from.height / 2 + ((to.top - from.top) * step) / 10;
        document.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x, clientY: y }));
        await wait(20);
    }

    await wait(150);
    const end = { ...init, clientX: x, clientY: to.top + to.height / 2 };
    document.dispatchEvent(new PointerEvent('pointerup', end));
    document.dispatchEvent(new MouseEvent('mouseup', end));
    source.dispatchEvent(new MouseEvent('click', end));
}

function wait(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
