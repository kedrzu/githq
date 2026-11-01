import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import type { VueContainer } from '@nzyme/vue-ioc/createContainer.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DropdownMenuItem } from 'reka-ui';
import { createApp, h, ref, shallowRef } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type {
    ListContextMenuProps,
    ListEntry,
    ListGroup,
    ListLayout,
    ListMove,
    ListRow,
    ListStack,
} from './ListTypes.js';
import ListView from './ListView.vue';

// Mounted by hand rather than from a story: these tests change the groups under the list, as a sync or an edit does.

/** Columns of a board: each group's key and the ids in it, or the stacks folded there. */
type Columns = readonly (readonly [string, readonly (SampleStackEntry | string)[]])[];

/** A stack's entry: its pull requests in the group, and the one Enter opens. */
interface SampleStackEntry {
    readonly stack: string;
    readonly members: readonly string[];
    readonly open: string;
}

/** In a group between two rows: the stack S_1 of p1–p3, Enter opening p2. */
const STACKED: Columns = [['todo', ['a1', { stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' }, 'a2']]];

/** A board with the stack S_1 as one card between two others, and a column to move it into. */
const STACKED_BOARD: Columns = [
    ['todo', ['a1', { stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' }, 'a2']],
    ['done', ['c1']],
];

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
    expect(view.moves).toEqual([{ ids: ['a1'], from: 'todo', to: 'empty' }]);

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
    expect(view.moves).toEqual([{ ids: ['a1'], from: 'todo', to: 'done' }]);
    await expect.poll(selectedCard).toBe('a1');
});

test('board: a stack is one card, j/k stepping over it whole; Space expands it to list its pull requests inside it', async () => {
    const view = mount(STACKED_BOARD, 'board');
    expect(view.listed.at(-1)).toEqual(['a1', 'p1', 'p2', 'p3', 'a2', 'c1']);

    await userEvent.keyboard('jj');
    await expect.poll(selectedCard).toBe('stack S_1');
    expect(view.selectedId.value).toBe('p2');

    // Expanded, it is still one card: its pull requests are inside it, not cards j steps onto.
    await userEvent.keyboard(' ');
    await expect.poll(rowTexts).toEqual(['a1', 'stack S_1p1[p2]p3', 'a2', 'c1']);
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a2');

    // A click on one inside it selects the card on it and opens it.
    await userEvent.click(page.getByRole('button', { name: 'p3' }));
    expect(view.opened).toEqual(['p3']);
    await expect.poll(selectedCard).toBe('stack S_1p1p2[p3]');

    await userEvent.keyboard(' ');
    await expect.poll(rowTexts).toEqual(['a1', 'stack S_1', 'a2', 'c1']);
});

test('board: with an item open, j/k walk a stack card’s pull requests one by one, expanded or not', async () => {
    const view = mount(STACKED_BOARD, 'board', { followOpened: true });

    await userEvent.keyboard('j{Enter}');
    for (const key of ['j', 'j', 'j', 'j', 'k']) {
        await userEvent.keyboard(key);
    }

    expect(view.opened).toEqual(['a1', 'p1', 'p2', 'p3', 'a2', 'p3']);
    expect(selectedCard()).toBe('stack S_1');

    await userEvent.keyboard(' kk');
    expect(view.opened).toEqual(['a1', 'p1', 'p2', 'p3', 'a2', 'p3', 'p2', 'p1']);
    await expect.poll(selectedCard).toBe('stack S_1[p1]p2p3');
});

test('board: ⇧→ or a drag of a stack card moves all its pull requests, and only when each of them may move', async () => {
    const view = mount(STACKED_BOARD, 'board', { canMove: entry => entry.id !== 'a2' });

    await userEvent.keyboard('jj{Shift>}{ArrowRight}{/Shift}');
    expect(view.moves).toEqual([{ ids: ['p1', 'p2', 'p3'], from: 'todo', to: 'done' }]);

    const card = page.getByText('stack S_1').element().closest('li');
    drag(card, page.getByRole('region', { name: 'done' }).element());
    expect(view.moves.at(-1)).toEqual({ ids: ['p1', 'p2', 'p3'], from: 'todo', to: 'done' });
    expect(view.moves).toHaveLength(2);

    view.unmount();
    const held = mount(STACKED_BOARD, 'board', { canMove: entry => entry.id !== 'p2' });
    await userEvent.keyboard('jj{Shift>}{ArrowRight}{/Shift}');
    expect(held.moves).toEqual([]);
    expect(page.getByText('stack S_1').element().closest('li')?.getAttribute('draggable')).toBeNull();
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

test('a stack entry is collapsed; → expands it, ← collapses it — from a row inside too, selecting the entry', async () => {
    const view = mount(STACKED, 'list');
    expect(rowTexts()).toEqual(['a1', 'stack S_1', 'a2']);

    await userEvent.keyboard('jj{ArrowRight}');
    expect(rowTexts()).toEqual(['a1', 'stack S_1', 'p1', 'p2', 'p3', 'a2']);
    await userEvent.keyboard('jj');
    await expect.poll(selectedCard).toBe('p2');

    await userEvent.keyboard('{ArrowLeft}');
    expect(rowTexts()).toEqual(['a1', 'stack S_1', 'a2']);
    await expect.poll(selectedCard).toBe('stack S_1');

    // The chevron toggles it and opens nothing.
    await userEvent.click(page.getByRole('button', { name: 'Expand the stack' }));
    expect(rowTexts()).toContain('p3');
    await userEvent.click(page.getByRole('button', { name: 'Collapse the stack' }));
    expect(rowTexts()).not.toContain('p3');
    expect(view.opened).toEqual([]);
});

test('expanding a stack lasts across the lists of the session', async () => {
    const container = createListContainer();
    const first = mount(STACKED, 'list', { container });
    await userEvent.keyboard('jj{ArrowRight}');
    first.unmount();

    mount([['done', [{ stack: 'S_1', members: ['p1', 'p3'], open: 'p1' }]]], 'list', { container });
    expect(rowTexts()).toEqual(['stack S_1', 'p1', 'p3']);
});

test('the items handed over walk a stack’s pull requests one by one, never the entry’s own id', async () => {
    const view = mount(STACKED, 'list');
    expect(view.listed.at(-1)).toEqual(['a1', 'p1', 'p2', 'p3', 'a2']);

    await userEvent.keyboard('jj{ArrowRight}');
    expect(view.listed.at(-1)).toEqual(['a1', 'p1', 'p2', 'p3', 'a2']);
});

test('Enter or a click on an entry opens the pull request it names', async () => {
    const view = mount(STACKED, 'list');

    await userEvent.keyboard('jj{Enter}');
    expect(view.opened).toEqual(['p2']);

    await userEvent.keyboard('j');
    await userEvent.click(page.getByText('stack S_1'));
    expect(view.opened).toEqual(['p2', 'p2']);
});

test('with an item open, j/k walk a collapsed entry’s pull requests one by one, entering it at its first from above and at its last from below; with none open, entry by entry', async () => {
    const view = mount(
        [
            [
                'todo',
                [
                    'a1',
                    { stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' },
                    { stack: 'S_2', members: ['q1', 'q2'], open: 'q1' },
                    'a2',
                ],
            ],
        ],
        'list',
        { followOpened: true },
    );

    await userEvent.keyboard('j{Enter}');
    for (const key of ['j', 'j']) {
        await userEvent.keyboard(key);
    }

    // The entry stays selected while the opened pull request moves inside it.
    expect(selectedCard()).toBe('stack S_1');
    for (const key of ['j', 'j', 'j', 'j', 'k', 'k', 'k']) {
        await userEvent.keyboard(key);
    }

    expect(view.opened).toEqual(['a1', 'p1', 'p2', 'p3', 'q1', 'q2', 'a2', 'q2', 'q1', 'p3']);
    expect(selectedCard()).toBe('stack S_1');

    view.openedId.value = null;
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('stack S_2');
    expect(view.opened).toHaveLength(10);
});

test('with an item open, j/k walk an expanded entry’s rows one by one, passing over the entry itself', async () => {
    const view = mount(STACKED, 'list', { followOpened: true });
    await userEvent.keyboard('j{Enter}');
    await userEvent.click(page.getByRole('button', { name: 'Expand the stack' }));

    for (const key of ['j', 'j', 'j', 'j', 'k', 'k', 'k', 'k']) {
        await userEvent.keyboard(key);
    }

    expect(view.opened).toEqual(['a1', 'p1', 'p2', 'p3', 'a2', 'p3', 'p2', 'p1', 'a1']);
    expect(selectedCard()).toBe('a1');
});

test('keys pressed before the opened item catches up walk on from the last one they opened', async () => {
    const view = mount(STACKED, 'list');
    await userEvent.keyboard('jj{Enter}');
    view.openedId.value = 'p2';

    await userEvent.keyboard('jj');
    expect(view.opened).toEqual(['p2', 'p3', 'a2']);
});

test('an item opened inside a collapsed entry selects the entry; once expanded, its row', async () => {
    const view = mount(STACKED, 'list');

    view.selectedId.value = 'p3';
    await expect.poll(selectedCard).toBe('stack S_1');

    // A sync reorders the group: the entry stays selected.
    view.columns.value = [['todo', ['a2', { stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' }, 'a1']]];
    await expect.poll(rowTexts).toEqual(['a2', 'stack S_1', 'a1']);
    expect(selectedCard()).toBe('stack S_1');

    await userEvent.keyboard('{ArrowRight}');
    view.selectedId.value = 'p1';
    await expect.poll(selectedCard).toBe('p1');
});

test('x on a collapsed entry takes all its pull requests, on a row inside that one alone; the menu acts on them', async () => {
    const view = mount(STACKED, 'list', { contextMenu: true });

    await userEvent.keyboard('jjx');
    expect(view.checkedIds.value).toEqual(['p1', 'p2', 'p3']);
    await userEvent.keyboard('x');
    expect(view.checkedIds.value).toEqual([]);

    await userEvent.keyboard('{ArrowRight}jx');
    expect(view.checkedIds.value).toEqual(['p1']);
    await userEvent.keyboard('{Escape}');

    await userEvent.click(page.getByText('stack S_1'), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Open p1,p2,p3' }));
    expect(view.opened.at(-1)).toBe('p2');
});

/** Native drag and drop of `card` onto `column`, as the browser fires it. */
function drag(card: Element | null, column: Element) {
    const dataTransfer = new DataTransfer();
    card?.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    column.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    column.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    card?.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
}

/** What the test's card is drawn from: `ListView`'s card slot props it uses. */
interface CardProps {
    readonly entry: ListEntry<string>;
    readonly stack: ListStack | null;
    readonly nested: readonly ListEntry<string>[];
    readonly expanded: boolean;
    readonly selectedMember: string | null;
    readonly openMember: (id: string) => void;
}

interface MountOptions {
    readonly canMove?: (entry: ListEntry<string>, from: string, to: string) => boolean;
    /** Gives the list a context menu naming the ids it is drawn for, with an "Open" button. */
    readonly contextMenu?: boolean;
    /** The app's services, shared by the lists mounted in one test; a container of its own when not given. */
    readonly container?: VueContainer;
    /** The item opened is the one the list is told is open, as the app's item view does. */
    readonly followOpened?: boolean;
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

    const container = options.container ?? createListContainer();
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
                    onOpen: (id: string) => {
                        opened.push(id);
                        if (options.followOpened) {
                            openedId.value = id;
                        }
                    },
                    onMove: (move: ListMove) => moves.push(move),
                    onListed: (ids: readonly string[]) => listed.push(ids),
                },
                {
                    row: ({ entry, stack }: { entry: ListEntry<string>; stack: ListStack | null }) =>
                        h('span', stack ? `stack ${stack.id}` : entry.value),
                    card: (props: CardProps) =>
                        props.stack
                            ? h('span', [
                                  `stack ${props.stack.id}`,
                                  ...(props.expanded
                                      ? props.nested.map(member =>
                                            h(
                                                'button',
                                                {
                                                    type: 'button',
                                                    // As `StackCard`'s: they take no focus, and the click opens nothing else.
                                                    onMousedown: (event: MouseEvent) => event.preventDefault(),
                                                    onClick: (event: MouseEvent) => {
                                                        event.stopPropagation();
                                                        props.openMember(member.id);
                                                    },
                                                },
                                                props.selectedMember === member.id ? `[${member.value}]` : member.value,
                                            ),
                                        )
                                      : []),
                              ])
                            : h('span', props.entry.value),
                    ...(options.contextMenu && {
                        contextMenu: ({ ids, open }: ListContextMenuProps) =>
                            h(DropdownMenuItem, { onSelect: open }, () => `Open ${ids.join(',')}`),
                    }),
                },
            ),
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    let mounted = true;
    onTestFinished(unmount);

    return { columns, selectedId, checkedIds, openedId, opened, moves, listed, unmount };

    function unmount() {
        if (mounted) {
            mounted = false;
            app.unmount();
            host.remove();
        }
    }
}

function createListContainer() {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    return container;
}

function toGroup(key: string, ids: readonly (SampleStackEntry | string)[]): ListGroup<string> {
    return { key, label: key, arrived: true, droppable: true, rows: ids.map(id => toRow(key, id)) };
}

function toRow(group: string, row: SampleStackEntry | string): ListRow<string> {
    if (typeof row === 'string') {
        return { key: `${group}:${row}`, id: row, value: row, nested: [] };
    }

    const stack: ListStack = {
        id: row.stack,
        description: {
            name: { title: row.stack, issueId: null },
            size: row.members.length,
            held: row.members.length,
            pips: [],
            state: { kind: 'ready', openCount: row.members.length },
            landed: 0,
            updatedAt: '',
        },
        open: row.open,
        pullRequests: [],
    };
    const id = `stack:${row.stack}`;
    return {
        key: `${group}:${id}`,
        id,
        value: row.open,
        nested: row.members.map(member => ({ key: `${group}:${member}`, id: member, value: member })),
        stack,
    };
}

/** The texts of the rows shown, top to bottom. */
function rowTexts() {
    return [...document.querySelectorAll('[data-entry-key]')].map(row => row.textContent?.trim() ?? '');
}

/** The text of the selected card or row, or `null`. */
function selectedCard() {
    return document.querySelector('[aria-current="true"]')?.textContent?.trim() ?? null;
}

/** The group the selected card or row is in. */
function selectedColumn() {
    return document.querySelector('[aria-current="true"]')?.closest('section')?.getAttribute('aria-label') ?? null;
}
