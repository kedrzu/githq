import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DropdownMenuItem } from 'reka-ui';
import { createApp, h, ref, shallowRef } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { ListContextMenuProps, ListEntry, ListGroup, ListLayout, ListMove } from './ListTypes.js';
import ListView from './ListView.vue';

// Mounted by hand rather than from a story: these tests change the groups under the list, as a sync or an edit does.

/** Columns of a board: each group's key and the ids in it. */
type Columns = readonly (readonly [string, readonly string[]])[];

const BOARD: Columns = [
    ['todo', ['a1', 'a2', 'a3']],
    ['empty', []],
    ['doing', ['b1']],
    ['done', ['c1', 'c2']],
];

test('board: ↓/↑ stay within the column, ←/→ go to the same height in the next column that has cards', async () => {
    mount(BOARD, 'board');

    await userEvent.keyboard('jjj');
    await expect.poll(selectedCard).toBe('a3');
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a3');

    // Past the empty column, to the only card of "doing".
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(selectedCard).toBe('b1');
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(selectedCard).toBe('c1');
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(selectedCard).toBe('c2');
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(selectedCard).toBe('c2');

    // Back from the second card: "doing" has one, and from there the first of "todo".
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect.poll(selectedCard).toBe('a1');
});

test('board: Enter or a click opens the card; while one is open, moving the selection opens the next in its place', async () => {
    const view = mount(BOARD, 'board');

    await userEvent.keyboard('j{Enter}');
    expect(view.opened).toEqual(['a1']);

    view.openedId.value = 'a1';
    await userEvent.keyboard('{ArrowRight}');
    expect(view.opened).toEqual(['a1', 'b1']);

    await userEvent.click(page.getByText('c2'));
    expect(view.opened).toEqual(['a1', 'b1', 'c2']);
    await expect.poll(selectedCard).toBe('c2');
});

test('the selection follows its item into another column, and to the neighbour when its item leaves', async () => {
    const view = mount(BOARD, 'board');
    await userEvent.keyboard('jj');
    await expect.poll(selectedCard).toBe('a2');

    // A sync (or an edit) moves a2 to "done".
    view.columns.value = [
        ['todo', ['a1', 'a3']],
        ['empty', []],
        ['doing', ['b1']],
        ['done', ['a2', 'c1', 'c2']],
    ];
    await expect.poll(selectedCard).toBe('a2');
    await expect.poll(selectedColumn).toBe('done');

    // It is closed: the selection goes to the card after it.
    view.columns.value = [
        ['todo', ['a1', 'a3']],
        ['empty', []],
        ['doing', ['b1']],
        ['done', ['c1', 'c2']],
    ];
    await expect.poll(selectedCard).toBe('c1');
});

test('⇧→/⇧← move the card into the next column that takes it; a card that may not move stays', async () => {
    const view = mount(BOARD, 'board', { canMove: entry => entry.id !== 'b1' });

    await userEvent.keyboard('j{Shift>}{ArrowRight}{/Shift}');
    // "empty" takes it too: the next column is the one it goes to.
    expect(view.moves).toEqual([{ id: 'a1', from: 'todo', to: 'empty' }]);

    await userEvent.keyboard('{ArrowRight}{Shift>}{ArrowRight}{/Shift}');
    await expect.poll(selectedCard).toBe('b1');
    expect(view.moves).toHaveLength(1);
});

test('a card is dragged into another column that takes it', async () => {
    const view = mount(BOARD, 'board', { canMove: (_entry, _from, to) => to !== 'empty' });

    const card = page.getByText('a1').element().closest('li');
    expect(card?.getAttribute('draggable')).toBe('true');
    drag(card, page.getByRole('region', { name: 'empty' }).element());
    expect(view.moves).toEqual([]);
    drag(card, page.getByRole('region', { name: 'done' }).element());
    expect(view.moves).toEqual([{ id: 'a1', from: 'todo', to: 'done' }]);
    await expect.poll(selectedCard).toBe('a1');
});

test('list: ←/→ move nothing, ↓ crosses into the next group', async () => {
    mount(BOARD, 'list');

    await userEvent.keyboard('jjj{ArrowRight}');
    await expect.poll(selectedCard).toBe('a3');
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('b1');
});

test('an item listed in two groups is selected in one place; x adds the item once', async () => {
    const view = mount(
        [
            ['bug', ['a', 'b']],
            ['calendar', ['a']],
        ],
        'list',
    );

    await userEvent.keyboard('jjj');
    await expect.poll(selectedColumn).toBe('calendar');
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);

    await userEvent.keyboard('x');
    expect(view.checkedIds.value).toEqual(['a']);
    expect(view.listed.at(-1)).toEqual(['a', 'b']);
});

/** Native drag and drop of `card` onto `column`, as the browser fires it. */
function drag(card: Element | null, column: Element) {
    const dataTransfer = new DataTransfer();
    card?.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    column.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    column.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    card?.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
}

interface MountOptions {
    readonly canMove?: (entry: ListEntry<string>, from: string, to: string) => boolean;
    /** Gives the list a context menu naming the ids it is drawn for, with an "Open" button. */
    readonly contextMenu?: boolean;
}

test('a right-click on a row opens the context menu for it alone and selects it; on one of the items edited together, for all of them', async () => {
    const view = mount([['todo', ['a1', 'a2', 'a3']]], 'list', { contextMenu: true });

    await userEvent.click(page.getByText('a2'), { button: 'right' });
    await expect.element(page.getByRole('menuitem', { name: 'Open a2' })).toBeVisible();
    await expect.poll(selectedCard).toBe('a2');
    await userEvent.click(page.getByRole('menuitem', { name: 'Open a2' }));
    expect(view.opened).toEqual(['a2']);

    view.checkedIds.value = ['a1', 'a3'];
    await userEvent.click(page.getByText('a3'), { button: 'right' });
    await expect.element(page.getByRole('menuitem', { name: 'Open a1,a3' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    // Kept: Escape closed the menu, not the items edited together.
    expect(view.checkedIds.value).toEqual(['a1', 'a3']);

    // Outside them, for the one right-clicked.
    await userEvent.click(page.getByText('a2'), { button: 'right' });
    await expect.element(page.getByRole('menuitem', { name: 'Open a2' })).toBeVisible();
});

test('without a context menu, or off the rows, a right-click leaves the browser its own menu', async () => {
    mount([['todo', ['a1']]], 'list', { contextMenu: true });

    await userEvent.click(page.getByRole('button', { name: /todo/ }), { button: 'right' });
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

/** Mounts the list over `initial`, holding its selection like a page does; every group takes moves. */
function mount(initial: Columns, layout: ListLayout, options: MountOptions = {}) {
    const columns = shallowRef<Columns>(initial);
    const selectedId = ref<string | null>(null);
    const checkedIds = ref<readonly string[]>([]);
    const openedId = ref<string | null>(null);
    const opened: string[] = [];
    const moves: ListMove[] = [];
    const listed: (readonly string[])[] = [];

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    host.style.height = '100vh';
    host.style.display = 'flex';
    document.body.append(host);

    const app = createApp({
        setup: () => () =>
            h(
                ListView<string>,
                {
                    groups: columns.value.map(([key, ids]) => toGroup(key, ids)),
                    layout,
                    canMove: options.canMove ?? (() => true),
                    selectedId: selectedId.value,
                    'onUpdate:selectedId': (value: string | null) => {
                        selectedId.value = value;
                    },
                    checkedIds: checkedIds.value,
                    'onUpdate:checkedIds': (value: readonly string[]) => {
                        checkedIds.value = value;
                    },
                    openedId: openedId.value,
                    onOpen: (id: string) => opened.push(id),
                    onMove: (move: ListMove) => moves.push(move),
                    onListed: (ids: readonly string[]) => listed.push(ids),
                },
                {
                    row: ({ entry }: { entry: ListEntry<string> }) => h('span', entry.value),
                    card: ({ entry }: { entry: ListEntry<string> }) => h('span', entry.value),
                    ...(options.contextMenu && {
                        contextMenu: ({ ids, open }: ListContextMenuProps) =>
                            h(DropdownMenuItem, { onSelect: open }, () => `Open ${ids.join(',')}`),
                    }),
                },
            ),
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { columns, checkedIds, openedId, opened, moves, listed };
}

function toGroup(key: string, ids: readonly string[]): ListGroup<string> {
    return {
        key,
        label: key,
        arrived: true,
        droppable: true,
        rows: ids.map(id => ({ key: `${key}:${id}`, id, value: id, nested: [] })),
    };
}

/** The text of the selected card or row, or `null`. */
function selectedCard() {
    return document.querySelector('[aria-current="true"]')?.textContent?.trim() ?? null;
}

/** The group the selected card or row is in. */
function selectedColumn() {
    return document.querySelector('[aria-current="true"]')?.closest('section')?.getAttribute('aria-label') ?? null;
}
