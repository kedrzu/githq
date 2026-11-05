import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import type { VueContainer } from '@nzyme/vue-ioc/createContainer.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DropdownMenuItem } from 'reka-ui';
import { injectContext, provideContext } from '@nzyme/vue-utils/context.js';
import { computed, createApp, defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { MergeContext } from '@/merge/MergeContext.js';
import type { MergePanelOpenOptions } from '@/merge/MergePanelStore.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import type { BrowserShape } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { matchText } from '@/testing/matchText.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';
import { sampleStack, sampleStackDescription } from '@/testing/sampleStacks.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { trackTabFocus } from '@/testing/trackTabFocus.js';

import { ExpandedStacks } from './ExpandedStacks.js';
import type {
    ListContextMenuProps,
    ListedItems,
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
    /** How it stands; ready with no pips when not given. */
    readonly description?: StackDescription;
    /** The issue serving as its header (`ListRow.stacks`, D12): the entry is that issue's row. */
    readonly header?: string;
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

test('board: a stack is one card; Space expands it to list its pull requests inside it, each a step after the card', async () => {
    const view = mount(STACKED_BOARD, 'board');
    expect(view.listed.at(-1)?.all).toEqual(['a1', 'p1', 'p2', 'p3', 'a2', 'c1']);

    await userEvent.keyboard('jj');
    await expect.poll(selectedCard).toBe('stack S_1');
    expect(view.selectedId.value).toBe('p2');

    // Still one card, drawn alone: nothing of it is selected but the card until a step reaches one.
    await userEvent.keyboard(' ');
    await expect.poll(rowTexts).toEqual(['a1', 'stack S_1p1p2p3', 'a2', 'c1']);
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('stack S_1[p1]p2p3');

    // A click on one inside it selects it and opens it, the one Enter opens on the card too.
    await userEvent.click(page.getByRole('button', { name: 'p3' }));
    expect(view.opened).toEqual(['p3']);
    await expect.poll(selectedCard).toBe('stack S_1p1p2[p3]');
    await userEvent.click(page.getByRole('button', { name: 'p2' }));
    expect(view.opened).toEqual(['p3', 'p2']);
    await expect.poll(selectedCard).toBe('stack S_1p1[p2]p3');
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('stack S_1p1p2[p3]');

    // Space on one of them collapses the card, the selection back on it.
    await userEvent.keyboard(' ');
    await expect.poll(rowTexts).toEqual(['a1', 'stack S_1', 'a2', 'c1']);
    expect(selectedCard()).toBe('stack S_1');
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a2');
});

test('board: on a pull request inside a card, x, ⇧J and ⇧→ take the card and ←/→ leave from its height', async () => {
    const view = mount(STACKED_BOARD, 'board');
    await userEvent.keyboard('jj jj');
    await expect.poll(selectedCard).toBe('stack S_1p1[p2]p3');

    await userEvent.keyboard('x');
    expect(view.checkedIds.value).toEqual(['p1', 'p2', 'p3']);
    await userEvent.keyboard('{Escape}{Shift>}{ArrowRight}{/Shift}');
    expect(view.moves).toEqual([{ ids: ['p1', 'p2', 'p3'], from: 'todo', to: 'done' }]);

    // The card's own height, not the pull request's: the only card of "done" and back to the one at its height.
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(selectedCard).toBe('c1');
    await userEvent.keyboard('{ArrowLeft}jj');
    await expect.poll(selectedCard).toBe('stack S_1[p1]p2p3');

    // ⇧J crosses the card in one step, from inside it too; and from the card to the next.
    await userEvent.keyboard('{Shift>}J{/Shift}');
    expect(view.checkedIds.value).toEqual(['p1', 'p2', 'p3', 'a2']);
    await expect.poll(selectedCard).toBe('a2');
    await userEvent.keyboard('{Escape}{Shift>}K{/Shift}');
    expect(view.checkedIds.value).toEqual(['p1', 'p2', 'p3', 'a2']);
    await expect.poll(selectedCard).toBe('stack S_1p1p2p3');
});

test('board: the same j sequence with an item open and without, a collapsed card one step and an expanded one a step and one for each pull request', async () => {
    const stacks: Columns = [
        [
            'todo',
            [
                'a1',
                { stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' },
                { stack: 'S_2', members: ['q1', 'q2'], open: 'q2' },
                'a2',
            ],
        ],
    ];
    const highlighted = ['a1', 'stack S_1', 'stack S_2q1q2', 'stack S_2[q1]q2', 'stack S_2q1[q2]', 'a2'];
    const closed = mount(stacks, 'board', { container: createExpandedContainer('S_2') });
    expect(await walkDown(highlighted.length)).toEqual(highlighted);
    expect(closed.opened).toEqual([]);
    closed.unmount();

    const open = mount(stacks, 'board', { container: createExpandedContainer('S_2'), followOpened: true });
    await userEvent.keyboard('j{Enter}');
    expect(await walkDown(highlighted.length - 1)).toEqual(highlighted.slice(1));
    // At each step, the step's item: on a card the one Enter opens.
    expect(open.opened).toEqual(['a1', 'p2', 'q2', 'q1', 'q2', 'a2']);

    // Up the same steps, back onto the card it is the item of.
    expect(await walkUp(3)).toEqual(['stack S_2q1[q2]', 'stack S_2[q1]q2', 'stack S_2q1q2']);
    expect(open.opened.slice(-3)).toEqual(['q2', 'q1', 'q2']);
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
    expect(view.listed.at(-1)?.all).toEqual(['a', 'b']);
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

test('every item handed over is a stack’s pull requests one by one, never the entry’s own id', async () => {
    const view = mount(STACKED, 'list');
    expect(view.listed.at(-1)?.all).toEqual(['a1', 'p1', 'p2', 'p3', 'a2']);

    await userEvent.keyboard('jj{ArrowRight}');
    await expect.poll(() => view.listed.at(-1)?.steps).toContain('p1');
    expect(view.listed.at(-1)?.all).toEqual(['a1', 'p1', 'p2', 'p3', 'a2']);
});

test('a collapsed entry is one step, on what Enter opens, standing for its other pull requests; expanded, its rows are the steps', async () => {
    const view = mount(STACKED, 'list');
    expect(view.listed.at(-1)?.steps).toEqual(['a1', 'p2', 'a2']);
    expect(view.listed.at(-1)?.stepOf).toEqual(
        new Map([
            ['p1', 'p2'],
            ['p3', 'p2'],
        ]),
    );

    await userEvent.keyboard('jj{ArrowRight}');
    await expect.poll(() => view.listed.at(-1)?.steps).toEqual(['a1', 'p1', 'p2', 'p3', 'a2']);
    expect(view.listed.at(-1)?.stepOf.size).toBe(0);
});

test('an issue with a stack under it keeps its step, collapsed standing for the pull requests and expanded followed by them', async () => {
    const view = mount([['todo', [{ header: 'i1', stack: 'S_1', members: ['p1', 'p2'], open: 'p1' }, 'a1']]], 'list');
    expect(view.listed.at(-1)?.steps).toEqual(['i1', 'a1']);
    expect(view.listed.at(-1)?.stepOf).toEqual(
        new Map([
            ['p1', 'i1'],
            ['p2', 'i1'],
        ]),
    );

    await userEvent.keyboard('j{ArrowRight}');
    await expect.poll(() => view.listed.at(-1)?.steps).toEqual(['i1', 'p1', 'p2', 'a1']);
    expect(view.listed.at(-1)?.stepOf.size).toBe(0);
});

test('an item listed on its own too keeps its own step, not the one of a collapsed entry it is also in', () => {
    const view = mount(
        [
            ['todo', [{ stack: 'S_1', members: ['p1', 'p2'], open: 'p1' }]],
            ['done', ['p2']],
        ],
        'list',
    );

    expect(view.listed.at(-1)?.steps).toEqual(['p1', 'p2']);
    expect(view.listed.at(-1)?.stepOf.size).toBe(0);
});

test('around: what the keys reach from the cursor, an expanded entry’s next being its first row; none with no cursor or the list gone', async () => {
    const view = mount(STACKED, 'list');
    expect(view.listed.at(-1)?.around).toBeNull();

    await userEvent.keyboard('jj');
    await expect.poll(() => view.listed.at(-1)?.around).toEqual({ previous: 'a1', next: 'a2' });

    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => view.listed.at(-1)?.around).toEqual({ previous: 'a1', next: 'p1' });

    await userEvent.keyboard('j');
    await expect.poll(() => view.listed.at(-1)?.around).toEqual({ previous: 'p2', next: 'p2' });

    view.unmount();
    expect(view.listed.at(-1)?.around).toBeNull();
});

test('board: around stays within the column, as the keys do', async () => {
    const view = mount(BOARD, 'board');

    await userEvent.keyboard('jjj');
    await expect.poll(() => view.listed.at(-1)?.around).toEqual({ previous: 'a2', next: null });
});

test('a move of the cursor hands over the same steps, so nothing is worked out again', async () => {
    const view = mount(STACKED, 'list');
    const { steps, stepOf } = view.listed.at(-1) ?? {};

    await userEvent.keyboard('j');
    await expect.poll(() => view.listed.at(-1)?.around).not.toBeNull();
    expect(view.listed.at(-1)?.steps).toBe(steps);
    expect(view.listed.at(-1)?.stepOf).toBe(stepOf);
});

test('Enter or a click on an entry opens the pull request it names', async () => {
    const view = mount(STACKED, 'list');

    await userEvent.keyboard('jj{Enter}');
    expect(view.opened).toEqual(['p2']);

    await userEvent.keyboard('j');
    await userEvent.click(page.getByText('stack S_1'));
    expect(view.opened).toEqual(['p2', 'p2']);
});

test('the same j sequence with an item open and without, a collapsed entry one step and an expanded one a step and one for each row', async () => {
    const stacks: Columns = [
        [
            'todo',
            [
                'a1',
                { stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' },
                { stack: 'S_2', members: ['q1', 'q2'], open: 'q2' },
                'a2',
            ],
        ],
    ];
    const highlighted = ['a1', 'stack S_1', 'stack S_2', 'q1', 'q2', 'a2'];
    const closed = mount(stacks, 'list', { container: createExpandedContainer('S_2') });
    expect(await walkDown(highlighted.length)).toEqual(highlighted);
    expect(closed.opened).toEqual([]);
    closed.unmount();

    const open = mount(stacks, 'list', { container: createExpandedContainer('S_2'), followOpened: true });
    await userEvent.keyboard('j{Enter}');
    expect(await walkDown(highlighted.length - 1)).toEqual(highlighted.slice(1));
    // At each step, the step's item: on an entry the one Enter opens.
    expect(open.opened).toEqual(['a1', 'p2', 'q2', 'q1', 'q2', 'a2']);

    // Up the same steps, onto the entry whose item is open, and on past it with nothing left inside.
    expect(await walkUp(5)).toEqual(['q2', 'q1', 'stack S_2', 'stack S_1', 'a1']);
    expect(open.opened.slice(-5)).toEqual(['q2', 'q1', 'q2', 'p2', 'a1']);
});

test('an issue serving as a stack’s header is a step opening its own item, its pull requests no steps until expanded', async () => {
    const stacks: Columns = [['todo', ['a1', { header: 'i1', stack: 'S_1', members: ['p1', 'p2'], open: 'p1' }, 'a2']]];
    const view = mount(stacks, 'list', { followOpened: true });
    await userEvent.keyboard('j{Enter}');
    expect(await walkDown(2)).toEqual(['i1', 'a2']);
    expect(view.opened).toEqual(['a1', 'i1', 'a2']);
    await userEvent.keyboard('k{ArrowRight}');

    expect(await walkDown(3)).toEqual(['p1', 'p2', 'a2']);
    expect(await walkUp(3)).toEqual(['p2', 'p1', 'i1']);
    expect(view.opened.slice(-3)).toEqual(['p2', 'p1', 'i1']);
});

test('an item opened by the stack map stays open under its collapsed entry until a step leaves it, which at the end of the list none does', async () => {
    const view = mount(STACKED, 'list', { followOpened: true });
    await userEvent.keyboard('jj{Enter}');
    view.openedId.value = 'p3';
    view.selectedId.value = 'p3';
    await expect.poll(() => view.selectedId.value).toBe('p3');

    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual(['p2', 'a2']);

    view.openedId.value = 'p3';
    view.selectedId.value = 'p3';
    await expect.poll(selectedCard).toBe('stack S_1');
    view.columns.value = [['todo', [{ stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' }]]];
    await expect.poll(rowTexts).toEqual(['stack S_1']);
    await userEvent.keyboard('j');
    expect(view.opened).toEqual(['p2', 'a2']);
    expect(view.selectedId.value).toBe('p3');
});

test('keys pressed before the opened item catches up lose no step and never move the selection back', async () => {
    const view = mount(STACKED, 'list');
    await userEvent.keyboard('jj{ArrowRight}{Enter}');
    view.openedId.value = 'p2';

    // Back onto the very item still open is a step too: the address is on its way elsewhere.
    await userEvent.keyboard('jj');
    await expect.poll(selectedCard).toBe('p2');
    expect(view.opened).toEqual(['p2', 'p1', 'p2']);
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('p3');
    expect(view.opened).toEqual(['p2', 'p1', 'p2', 'p3']);

    // The address reaches an older step, writing its item back as `useItemList` does.
    view.openedId.value = 'p1';
    view.selectedId.value = 'p1';
    await nextTick();
    await nextTick();
    expect(selectedCard()).toBe('p3');

    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual(['p2', 'p1', 'p2', 'p3', 'a2']);

    // Caught up, what comes from outside moves the selection again.
    view.openedId.value = 'a2';
    await nextTick();
    view.openedId.value = 'p1';
    view.selectedId.value = 'p1';
    await expect.poll(selectedCard).toBe('p1');
});

test('in a modal the list leaves j/k and the arrows alone, and the selection follows the opened item', async () => {
    const container = createListContainer();
    container.resolve(LocalPreferences).itemArrangement.value = 'modal';
    const view = mount(STACKED, 'list', { container, followOpened: true });
    await userEvent.keyboard('j{Enter}');

    const seen: boolean[] = [];
    const listener = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    window.addEventListener('keydown', listener);
    onTestFinished(() => window.removeEventListener('keydown', listener));
    await userEvent.keyboard('jk{ArrowDown}{ArrowUp}{ArrowLeft}{ArrowRight}');
    expect(seen).toEqual([false, false, false, false, false, false]);
    expect(view.opened).toEqual(['a1']);
    expect(selectedCard()).toBe('a1');

    view.openedId.value = 'a2';
    view.selectedId.value = 'a2';
    await expect.poll(selectedCard).toBe('a2');

    // Closed, the keys are the list's again.
    view.openedId.value = null;
    await nextTick();
    await userEvent.keyboard('k');
    await expect.poll(selectedCard).toBe('stack S_1');
});

test('board: an item opened from outside selects its collapsed card; once expanded, the pull request inside it', async () => {
    const view = mount(STACKED_BOARD, 'board');

    view.selectedId.value = 'p3';
    await expect.poll(selectedCard).toBe('stack S_1');

    await userEvent.keyboard(' ');
    await expect.poll(rowTexts).toEqual(['a1', 'stack S_1p1p2p3', 'a2', 'c1']);
    view.selectedId.value = 'p1';
    await expect.poll(selectedCard).toBe('stack S_1[p1]p2p3');
    // Its own item keeps the expanded card selected, as the entry does in the list.
    await userEvent.keyboard('k');
    await expect.poll(selectedCard).toBe('stack S_1p1p2p3');
});

test('board: stepping scrolls to the pull request inside the card', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    onTestFinished(() => scroll.mockRestore());
    mount(STACKED_BOARD, 'board');
    await userEvent.keyboard('jj j');
    await expect.poll(selectedCard).toBe('stack S_1[p1]p2p3');

    await expect.poll(() => scroll.mock.contexts.at(-1)).toBe(page.getByRole('button', { name: '[p1]' }).element());
});

test('a selection given from outside is scrolled into sight', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    onTestFinished(() => scroll.mockRestore());
    const view = mount([['todo', ['a1', 'a2', 'a3']]], 'list');

    view.selectedId.value = 'a2';
    await expect.poll(selectedCard).toBe('a2');
    await expect.poll(() => scroll.mock.contexts.at(-1)).toBe(document.querySelector('[aria-current="true"]'));
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

test('⇧J crosses a collapsed entry in one step adding all its pull requests, also with an item open', async () => {
    const view = mount(STACKED, 'list', { followOpened: true });

    await userEvent.keyboard('j{Enter}{Shift>}J{/Shift}');
    expect(view.checkedIds.value).toEqual(['a1', 'p1', 'p2', 'p3']);
    await expect.poll(selectedCard).toBe('stack S_1 (checked)');

    await userEvent.keyboard('{Shift>}J{/Shift}');
    expect(view.checkedIds.value).toEqual(['a1', 'p1', 'p2', 'p3', 'a2']);
});

test('⇧J goes through an expanded entry row by row, the entry half marked while only some of them are taken', async () => {
    const view = mount(STACKED, 'list');

    await userEvent.keyboard('jj{ArrowRight}k{Shift>}JJ{/Shift}');
    expect(view.checkedIds.value).toEqual(['a1', 'p1']);
    await expect.poll(rowTexts).toEqual(['a1', 'stack S_1 (half)', 'p1', 'p2', 'p3', 'a2']);
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

/** What the test's row is drawn from: `ListView`'s row slot props it uses. */
interface RowProps {
    readonly entry: ListEntry<string>;
    readonly stack: ListStack | null;
    readonly checked: boolean;
    readonly halfChecked: boolean;
}

/** How a stack's entry in the test says it is selected. */
function getMark(checked: boolean, halfChecked: boolean) {
    return checked ? ' (checked)' : halfChecked ? ' (half)' : '';
}

interface MountOptions {
    readonly canMove?: (entry: ListEntry<string>, from: string, to: string) => boolean;
    /** Gives the list a context menu naming the ids it is drawn for, with an "Open" button. */
    readonly contextMenu?: boolean;
    /** The app's services, shared by the lists mounted in one test; a container of its own when not given. */
    readonly container?: VueContainer;
    /** The item opened is the one the list is told is open, as the app's item view does. */
    readonly followOpened?: boolean;
    /** The screen offers merging (the app's shell): rows draw a "Merge" button for those it may merge. */
    readonly merge?: MergeContext;
    /** The items with an edit of the user's on its way. */
    readonly edited?: ReadonlySet<string>;
    /** {@link mountRow}'s layout: the list when not given. */
    readonly layout?: ListLayout;
    /** Which entries can open over the list; all of them when not given. */
    readonly canOpenOver?: (value: string) => boolean;
}

/** A merge panel opened: for which item, and what it runs once the merge is sent. */
interface OpenedMerge {
    readonly id: string;
    readonly options: MergePanelOpenOptions | undefined;
}

/** The screen's merging, the viewer allowed to merge `allowed`; records the panels opened. */
function sampleMerging(allowed: readonly string[]) {
    const panels: OpenedMerge[] = [];
    const context: MergeContext = {
        canOpen: id => allowed.includes(id),
        open: (id, options) => panels.push({ id, options }),
        getRecord: () => null,
        getCommands: () => [],
        run: () => undefined,
    };
    return { context, panels };
}

/** As `ItemRow`'s follow-up: "Merge" where the viewer may merge it; the click is not the row's. */
const MergeButton = defineComponent({
    props: { id: { type: String, required: true } },
    setup(props) {
        const merging = injectContext(MergeContext, { optional: true });
        return () =>
            merging?.canOpen(props.id)
                ? h(
                      'button',
                      {
                          type: 'button',
                          onClick: (event: MouseEvent) => {
                              event.stopPropagation();
                              merging.open(props.id);
                          },
                      },
                      `Merge ${props.id}`,
                  )
                : null;
    },
});

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

test("Tab onto the board itself holds nothing: it takes the focus to scroll, and the keys stay the list's", async () => {
    trackTabFocus();
    mount([['todo', ['a1', 'a2']]], 'board');
    const board = document.querySelector('[data-screen-keys-root]');

    for (let tabs = 0; tabs < 40 && document.activeElement !== board; tabs++) {
        await userEvent.tab();
    }

    expect(document.activeElement).toBe(board);
    expect(board?.hasAttribute('data-tab-focus')).toBe(false);
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a1');
});

test("from a control Tab reached outside the list, the selected row's commands do not run: neither ⇧M nor a pull request's own", async () => {
    trackTabFocus();
    const control = document.createElement('button');
    document.body.prepend(control);
    onTestFinished(() => control.remove());
    const container = createListContainer();
    const store = container.resolve(ItemStore);
    await store.ready();
    store.upsertMany([samplePullRequest('a1')]);
    const merging = sampleMerging(['a1']);
    const run = vi.fn();
    const context: MergeContext = {
        ...merging.context,
        getCommands: () => [{ kind: 'updateBranch', method: 'MERGE' }],
        run,
    };
    const view = mount([['todo', ['a1']]], 'list', { merge: context, container, contextMenu: true });
    await userEvent.keyboard('j');
    await expect.poll(() => view.selectedId.value).toBe('a1');

    for (let tabs = 0; tabs < 40 && document.activeElement !== control; tabs++) {
        await userEvent.tab();
    }

    expect(control.hasAttribute('data-tab-focus')).toBe(true);
    await userEvent.keyboard('{Shift>}M{/Shift}u');
    expect(merging.panels).toEqual([]);
    expect(run).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}u');
    expect(run).toHaveBeenCalledTimes(1);
});

test('⇧M merges the selected pull request the viewer may merge — never one they may not, never several checked; once sent, the list moves to the next row (PM32a)', async () => {
    const merging = sampleMerging(['a1', 'a2']);
    const view = mount([['todo', ['a1', 'a2', 'a3']]], 'list', { merge: merging.context });
    const registry = view.container.resolve(CommandRegistry);
    const offered = () => registry.commands.some(command => command.id === 'list.merge' && registry.isEnabled(command));

    await userEvent.keyboard('j');
    await expect.poll(() => view.selectedId.value).toBe('a1');
    // The command menu offers it too.
    expect(offered()).toBe(true);
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(merging.panels.map(panel => panel.id)).toEqual(['a1']);

    merging.panels[0]?.options?.onSent?.([]);
    await expect.poll(() => view.selectedId.value).toBe('a2');

    // Several are never merged together: nothing is offered.
    view.checkedIds.value = ['a1', 'a2'];
    await expect.poll(offered).toBe(false);
    await userEvent.keyboard('{Shift>}M{/Shift}');
    view.checkedIds.value = [];

    await userEvent.keyboard('j');
    await expect.poll(() => view.selectedId.value).toBe('a3');
    expect(offered()).toBe(false);
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(merging.panels.map(panel => panel.id)).toEqual(['a1']);
});

test("PM38: ⇧M's title is the way forward the panel leads to, as the opened item's standing says it", async () => {
    const container = createListContainer();
    const store = container.resolve(ItemStore);
    await store.ready();
    store.upsertMany([
        { ...samplePullRequest('a1'), mergeStateStatus: 'BEHIND' },
        { ...samplePullRequest('a2'), isDraft: true, mergeStateStatus: 'DRAFT' },
    ]);
    const view = mount([['todo', ['a1', 'a2']]], 'list', { merge: sampleMerging(['a1', 'a2']).context, container });
    const registry = view.container.resolve(CommandRegistry);
    const title = () => registry.commands.find(command => command.id === 'list.merge')?.title;

    await userEvent.keyboard('j');
    await expect.poll(title).toBe('Update branch');
    await userEvent.keyboard('j');
    await expect.poll(title).toBe('Mark ready…');
});

test('D9, PM32a: ⇧M merges the one pull request checked, wherever the selected row is; once sent it is unchecked and the list moves past it', async () => {
    const merging = sampleMerging(['a2']);
    const view = mount([['todo', ['a1', 'a2', 'a3']]], 'list', { merge: merging.context });
    const registry = view.container.resolve(CommandRegistry);

    await userEvent.keyboard('j');
    await expect.poll(() => view.selectedId.value).toBe('a1');
    view.checkedIds.value = ['a2'];
    // Ahead of an opened item's, in the selection's section.
    await expect
        .poll(() => registry.commands.some(command => command.id === 'selection.merge' && registry.isEnabled(command)))
        .toBe(true);

    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(merging.panels.map(panel => panel.id)).toEqual(['a2']);
    await expect.poll(() => view.selectedId.value).toBe('a2');
    expect(view.checkedIds.value).toEqual(['a2']);

    merging.panels[0]?.options?.onSent?.([]);
    await expect.poll(() => view.selectedId.value).toBe('a3');
    expect(view.checkedIds.value).toEqual([]);
});

test('a row\'s "Merge" selects its row and opens the panel; once sent, the list moves on from it', async () => {
    const merging = sampleMerging(['a1']);
    const view = mount([['todo', ['a1', 'a2', 'a3']]], 'list', { merge: merging.context });

    await userEvent.keyboard('jjj');
    await expect.poll(() => view.selectedId.value).toBe('a3');
    await userEvent.click(page.getByRole('button', { name: 'Merge a1' }));
    await expect.poll(() => view.selectedId.value).toBe('a1');
    expect(merging.panels.map(panel => panel.id)).toEqual(['a1']);

    merging.panels[0]?.options?.onSent?.([]);
    await expect.poll(() => view.selectedId.value).toBe('a2');
});

test("D11, SP7: ⇧M on a stack's entry opens the panel for its whole stack; once sent the list moves past the entry and its rows", async () => {
    const merging = sampleMerging(['a1', 'p1', 'p2', 'p3']);
    mount(STACKED, 'list', { merge: merging.context });

    await userEvent.keyboard('jj');
    await expect.poll(selectedCard).toBe('stack S_1');
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(merging.panels.map(panel => [panel.id, panel.options?.wholeStack])).toEqual([['p1', true]]);
    merging.panels[0]?.options?.onSent?.([]);
    await expect.poll(selectedCard).toBe('a2');

    // Expanded, past its rows too: the entry is what was merged.
    await userEvent.keyboard('k{ArrowRight}');
    await expect.poll(rowTexts).toEqual(['a1Merge a1', 'stack S_1', 'p1Merge p1', 'p2Merge p2', 'p3Merge p3', 'a2']);
    await expect.poll(selectedCard).toBe('stack S_1');
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(merging.panels.map(panel => [panel.id, panel.options?.wholeStack])).toEqual([
        ['p1', true],
        ['p1', true],
    ]);
    merging.panels[1]?.options?.onSent?.([]);
    await expect.poll(selectedCard).toBe('a2');
});

test('D11: ⇧M on a row of an expanded stack takes everything up to it; once sent the list moves to the next row', async () => {
    const merging = sampleMerging(['p1', 'p2', 'p3']);
    mount(STACKED, 'list', { merge: merging.context });

    await userEvent.keyboard('jj{ArrowRight}jj');
    await expect.poll(selectedCard).toBe('p2Merge p2');
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(merging.panels.map(panel => [panel.id, panel.options?.wholeStack ?? false])).toEqual([['p2', false]]);
    merging.panels[0]?.options?.onSent?.([]);
    await expect.poll(selectedCard).toBe('p3Merge p3');
});

test("SP6: with one of an entry's pull requests open over the list, ⇧M is the opened one's (up to it), not the list's; without the screen's merging nothing is offered", async () => {
    const merging = sampleMerging(['p1', 'p2', 'p3']);
    const view = mount(STACKED, 'list', { merge: merging.context, followOpened: true });
    const registry = view.container.resolve(CommandRegistry);
    const offered = () => registry.commands.some(command => command.id === 'list.merge' && registry.isEnabled(command));

    await userEvent.keyboard('jj');
    await expect.poll(offered).toBe(true);
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => view.openedId.value).toBe('p2');
    await expect.poll(offered).toBe(false);
    view.unmount();

    const bare = mount(STACKED, 'list');
    const bareRegistry = bare.container.resolve(CommandRegistry);
    expect(bareRegistry.commands.some(command => command.id === 'list.merge')).toBe(false);
});

test("PM38, D11: ⇧M's title on a stack's entry is the way forward of the whole stack, as the panel opening on it", async () => {
    const members = sampleStack({ id: 'S_1', number: 10, members: [{}, {}, {}] });
    const ids = members.map(pr => pr.id);
    const held = members.map((pr, index): PullRequestItem =>
        index === 2 ? { ...pr, mergeStateStatus: 'BLOCKED' } : pr,
    );
    const rebase = members.map((pr, index): PullRequestItem => (index === 1 ? { ...pr, behindBase: true } : pr));
    const draft = members.map((pr, index): PullRequestItem => (index === 0 ? { ...pr, isDraft: true } : pr));
    const blocked = members.map((pr): PullRequestItem => ({ ...pr, mergeStateStatus: 'BLOCKED' }));
    const entry = (stacked: readonly PullRequestItem[]): Columns => [
        ['todo', [{ stack: 'S_1', members: ids, open: ids[0] ?? '', description: sampleStackDescription(stacked) }]],
    ];
    const merging = sampleMerging(ids);
    const view = mount(entry(members), 'list', { merge: merging.context });
    const registry = view.container.resolve(CommandRegistry);
    const title = () => registry.commands.find(command => command.id === 'list.merge')?.title;

    await userEvent.keyboard('j');
    await expect.poll(title).toBe('Merge all 3');
    view.columns.value = entry(held);
    await expect.poll(title).toBe('Merge 2');
    view.columns.value = entry(rebase);
    await expect.poll(title).toMatch(matchText('Rebase on GitHub'));
    view.columns.value = entry(draft);
    await expect.poll(title).toBe('Mark #10 ready…');
    view.columns.value = entry(blocked);
    await expect.poll(title).toBe('Merge…');
    view.columns.value = entry(members.map(pr => ({ ...pr, isMergeQueueEnabled: true })));
    await expect.poll(title).toBe('Queue…');
    view.columns.value = entry(
        members.map(pr => ({
            ...pr,
            mergeQueueEntry: {
                position: 1,
                state: 'QUEUED',
                estimatedTimeToMerge: null,
                enqueuedAt: '2026-11-03T00:00:00Z',
                enqueuer: 'mlaine',
            },
        })),
    );
    await expect.poll(title).toMatch(matchText('In the queue'));
});

test("D11: a stack's entry's context menu merges its whole stack", async () => {
    const merging = sampleMerging(['p1', 'p2', 'p3']);
    mount(STACKED, 'list', { merge: merging.context, contextMenu: true });

    await userEvent.click(page.getByText('stack S_1'), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Merge…' }));
    expect(merging.panels.map(panel => [panel.id, panel.options?.wholeStack])).toEqual([['p1', true]]);

    // A pull request's own row offers no merge of the stack.
    await userEvent.click(page.getByText('a1'), { button: 'right' });
    await expect.element(page.getByRole('menuitem', { name: 'Open a1' })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Merge…' })).not.toBeInTheDocument();
});

/** A list with a context menu over items in the local copy, every request to GitHub counted from when it is mounted. */
async function mountRow(columns: Columns, stored: readonly Item[], options: MountOptions = {}) {
    const request = vi.fn(() => Promise.resolve(new Response(null, { status: 502 })));
    const container = createListContainer(request);
    const store = container.resolve(ItemStore);
    await store.ready();
    store.upsertMany([...stored]);
    const view = mount(columns, options.layout ?? 'list', { contextMenu: true, ...options, container });
    const registry = container.resolve(CommandRegistry);
    return {
        view,
        request,
        registry,
        store,
        ids: () => registry.commands.map(command => command.id).filter(id => !id.startsWith('list.')),
        command: (id: string) => registry.commands.find(command => command.id === id),
    };
}

test("the cursor row: the chip names it and it has its context menu's actions; walking sends no request, a submenu's metadata is read as it opens", async () => {
    const row = await mountRow(
        [['todo', ['i1', 'p1']]],
        [{ ...sampleIssue('i1'), title: 'Sign-in redirects' }, samplePullRequest('p1')],
    );
    expect(row.registry.subject).toBeNull();

    await userEvent.keyboard('j');
    await expect
        .poll(() => row.registry.subject)
        .toEqual({
            kind: 'item',
            label: 'web#1',
            title: 'Sign-in redirects',
        });
    expect(row.ids()).toEqual(expect.arrayContaining(['item.state', 'item.labels', 'menu.copyLink', 'menu.comment']));
    expect(row.command('item.state')?.section).toBe('item');

    row.request.mockClear();
    await userEvent.keyboard('jkj');
    await expect.poll(() => row.registry.subject?.label).toBe('web#2');
    expect(row.request).not.toHaveBeenCalled();

    // Permissions from the item's copy of its repository; the submenu says it is still reading.
    expect(row.command('item.labels')?.options?.().loading).toBe(true);
    row.command('item.labels')?.prepare?.();
    await expect.poll(() => row.request.mock.calls.length).toBeGreaterThan(0);
});

test('a key whose value needs choosing opens the command menu at its submenu; the value picked goes to that row', async () => {
    const row = await mountRow([['todo', ['i1', 'i2']]], [sampleIssue('i1'), sampleIssue('i2')]);
    const edit = vi.spyOn(row.view.container.resolve(ItemEditor), 'edit');
    await userEvent.keyboard('jj');
    await expect.poll(() => row.view.selectedId.value).toBe('i2');

    for (const [key, id] of [
        ['{Shift>}X{/Shift}', 'item.state'],
        ['a', 'item.assignees'],
        ['l', 'item.labels'],
        ['m', 'item.milestone'],
    ] as const) {
        await userEvent.keyboard(key);
        expect(row.registry.menu?.commandId).toBe(id);
        row.registry.closeMenu();
    }

    const close = row
        .command('item.state')
        ?.options?.()
        .options.find(option => matchText('Close as completed').test(option.label));
    close?.pick();
    expect(edit).toHaveBeenCalledWith(['i2'], { kind: 'close', reason: 'COMPLETED' });
});

test("Enter and O stay the list's: drawn in the context menu, never run through the registry", async () => {
    const row = await mountRow([['todo', ['p1']]], [samplePullRequest('p1')]);
    const openInNewTab = vi.spyOn(row.view.container.resolve(Browser), 'openInNewTab');
    await userEvent.keyboard('j');
    await expect.poll(() => row.registry.subject).not.toBeNull();

    const keyed = row.registry.commands.filter(command => command.run && !command.id.startsWith('list.'));
    expect(keyed.map(command => command.key)).not.toContain('Enter');
    expect(keyed.map(command => command.key)).not.toContain('O');
    // Still offered in the menu, with no key.
    expect(row.command('menu.open')).toBeDefined();
    expect(row.command('menu.openOnGitHub')).toBeDefined();

    await userEvent.keyboard('o');
    expect(openInNewTab).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(row.view.opened).toEqual(['p1']);
});

test('the comment key opens the row, asking the opened item for its comment box', async () => {
    const row = await mountRow([['todo', ['i1']]], [sampleIssue('i1')]);
    await userEvent.keyboard('j');
    await expect.poll(() => row.command('menu.comment')).toBeDefined();

    await userEvent.keyboard('r');
    expect(row.view.opened).toEqual(['i1']);
    expect(row.view.container.resolve(ItemNavigation).commentRequest).toBe('i1');
});

test("D11: ⇧M on a plain row stays the list's, moving on once sent (PM32a), offered once among the row's actions", async () => {
    const merging = sampleMerging(['p1', 'p2']);
    const row = await mountRow([['todo', ['p1', 'p2']]], [samplePullRequest('p1'), samplePullRequest('p2')], {
        merge: merging.context,
    });
    await userEvent.keyboard('j');
    await expect.poll(() => row.registry.subject).not.toBeNull();

    const merges = row.registry.commands.filter(command => command.key === 'Shift+M');
    expect(merges.map(command => [command.id, command.section])).toEqual([['list.merge', 'item']]);

    await userEvent.keyboard('{Shift>}M{/Shift}');
    merging.panels[0]?.options?.onSent?.([]);
    await expect.poll(() => row.view.selectedId.value).toBe('p2');
});

test("D20, D11: a stack's entry stands for all its pull requests; ⇧M is its whole stack's, and of the ordinary commands only ⇧Q, through the first one queued", async () => {
    const queued: PullRequestItem = {
        ...samplePullRequest('p2'),
        mergeQueueEntry: {
            position: 1,
            state: 'QUEUED',
            estimatedTimeToMerge: null,
            enqueuedAt: '2026-11-03T00:00:00Z',
            enqueuer: 'mlaine',
        },
    };
    const run = vi.fn();
    const merging = sampleMerging(['p1', 'p2', 'p3']);
    const row = await mountRow(
        [['todo', [{ stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' }]]],
        [samplePullRequest('p1'), queued, samplePullRequest('p3')],
        {
            merge: {
                ...merging.context,
                getCommands: id => [
                    { kind: 'updateBranch', method: 'MERGE' },
                    ...(id === 'p2' ? [{ kind: 'dequeue' as const }] : []),
                ],
                run,
            },
        },
    );
    const edit = vi.spyOn(row.view.container.resolve(ItemEditor), 'edit');
    await userEvent.keyboard('j');
    await expect
        .poll(() => row.registry.subject)
        .toEqual({
            kind: 'selection',
            label: '3 pull requests',
            title: '3 pull requests',
        });

    await userEvent.keyboard('u');
    expect(run).not.toHaveBeenCalled();
    await userEvent.keyboard('{Shift>}Q{/Shift}');
    expect(run).toHaveBeenCalledExactlyOnceWith('p2', { kind: 'dequeue' });

    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(merging.panels.map(panel => [panel.id, panel.options?.wholeStack])).toEqual([['p1', true]]);

    await userEvent.keyboard('{Shift>}X{/Shift}');
    expect(row.registry.menu?.commandId).toBe('selection.state');
    row.registry.closeMenu();
    row.command('selection.state')?.options?.().options[0]?.pick();
    expect(edit).toHaveBeenCalledWith(['p1', 'p2', 'p3'], expect.objectContaining({ kind: 'close' }));
});

test("D11: a stack's entry with one pull request in its group gets no merge of its own and none of that one's ordinary commands", async () => {
    const run = vi.fn();
    const merging = sampleMerging(['p1']);
    const row = await mountRow([['todo', [{ stack: 'S_1', members: ['p1'], open: 'p1' }]]], [samplePullRequest('p1')], {
        merge: { ...merging.context, getCommands: () => [{ kind: 'updateBranch', method: 'MERGE' }], run },
    });
    await userEvent.keyboard('j');
    await expect.poll(() => row.registry.subject?.label).toMatch(matchText('1 pull request'));

    expect(row.registry.commands.filter(command => command.key === 'Shift+M').map(command => command.id)).toEqual([
        'list.merge',
    ]);
    await userEvent.keyboard('u');
    expect(run).not.toHaveBeenCalled();
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(merging.panels.map(panel => panel.options?.wholeStack)).toEqual([true]);
});

test('with items checked or an item open the row registers nothing', async () => {
    const row = await mountRow([['todo', ['i1', 'i2']]], [sampleIssue('i1'), sampleIssue('i2')], {
        followOpened: true,
    });
    await userEvent.keyboard('j');
    await expect.poll(() => row.registry.subject).not.toBeNull();

    await userEvent.keyboard('x');
    await expect.poll(() => row.registry.subject).toBeNull();
    expect(row.ids()).toEqual([]);

    await userEvent.keyboard('x');
    await expect.poll(() => row.registry.subject).not.toBeNull();

    await userEvent.keyboard('{Enter}');
    await expect.poll(() => row.view.openedId.value).toBe('i1');
    expect(row.registry.subject).toBeNull();
    expect(row.ids()).toEqual([]);
});

test('a draft, which the local copy does not know, registers no subject and no actions; a list without a context menu neither', async () => {
    const row = await mountRow([['todo', ['draft', 'i1']]], [sampleIssue('i1')]);
    await userEvent.keyboard('j');
    await expect.poll(() => row.view.selectedId.value).toBe('draft');
    expect(row.registry.subject).toBeNull();
    expect(row.ids()).toEqual([]);
    row.view.unmount();

    const bare = await mountRow([['todo', ['i1']]], [sampleIssue('i1')], { contextMenu: false });
    await userEvent.keyboard('j');
    await expect.poll(() => bare.view.selectedId.value).toBe('i1');
    expect(bare.registry.subject).toBeNull();
    expect(bare.ids()).toEqual([]);
});

test("a row's subject never survives the row: it goes with the row and with the list", async () => {
    const row = await mountRow([['todo', ['i1', 'p1']]], [sampleIssue('i1'), samplePullRequest('p1')]);
    await userEvent.keyboard('j');
    await expect.poll(() => row.registry.subject?.label).toBe('web#1');

    row.view.columns.value = [['todo', ['p1']]];
    await expect.poll(() => row.registry.subject?.label).toBe('web#2');

    row.view.columns.value = [['todo', []]];
    await expect.poll(() => row.registry.subject).toBeNull();
    expect(row.ids()).toEqual([]);

    row.view.columns.value = [['todo', ['p1']]];
    await userEvent.keyboard('j');
    await expect.poll(() => row.registry.subject?.label).toBe('web#2');
    row.view.unmount();
    expect(row.registry.subject).toBeNull();
    expect(row.registry.commands).toEqual([]);
});

test("board: a stack's card acts on all its pull requests; on a pull request inside it, as on a list's row, on that one", async () => {
    const row = await mountRow(
        [['todo', [{ stack: 'S_1', members: ['p1', 'p2'], open: 'p1' }]]],
        [samplePullRequest('p1'), samplePullRequest('p2')],
        { layout: 'board' },
    );
    await userEvent.keyboard('j');
    await expect.poll(() => row.registry.subject?.label).toBe('2 pull requests');

    await userEvent.keyboard(' j');
    await expect.poll(selectedCard).toBe('stack S_1[p1]p2');
    await expect.poll(() => row.registry.subject).toMatchObject({ kind: 'item', title: 'Pull request p1' });
});

/** A list of three rows with `id` open over it, the list told so as the app's item view does. */
async function mountOpened(columns: Columns, id: string, options: MountOptions = {}) {
    const view = mount(columns, 'list', { ...options, followOpened: true });
    view.selectedId.value = id;
    view.openedId.value = id;
    await expect.poll(selectedCard).not.toBeNull();
    return view;
}

const THREE: Columns = [['todo', ['a1', 'a2', 'a3']]];

test('the opened item leaving through the user’s edit: the cursor moves to the next row and opens it, once, however many rebuilds follow', async () => {
    const view = await mountOpened(THREE, 'a2', { edited: new Set(['a2']) });

    view.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBe('a3');
    expect(view.opened).toEqual(['a3']);
    expect(view.selectedId.value).toBe('a3');

    // The list rebuilds, the address still catching up and then caught up.
    view.columns.value = [['todo', ['a1', 'a3', 'b1']]];
    await nextTick();
    view.columns.value = [['todo', ['a1', 'a3']]];
    await nextTick();
    await nextTick();
    expect(selectedCard()).toBe('a3');
    expect(view.opened).toEqual(['a3']);
});

test('a failed edit bringing the row back leaves the cursor on the neighbour', async () => {
    const view = await mountOpened(THREE, 'a2', { edited: new Set(['a2']) });

    view.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBe('a3');

    view.columns.value = THREE;
    await expect.poll(rowTexts).toEqual(['a1', 'a2', 'a3']);
    await nextTick();
    expect(selectedCard()).toBe('a3');
    expect(view.selectedId.value).toBe('a3');
    expect(view.opened).toEqual(['a3']);
});

test('the last row leaving through the user’s edit: the previous row becomes current', async () => {
    const view = await mountOpened(THREE, 'a3', { edited: new Set(['a3']) });

    view.columns.value = [['todo', ['a1', 'a2']]];
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual(['a2']);
});

test('a bulk edit: the cursor goes to the first row left after those that went', async () => {
    const view = await mountOpened([['todo', ['a1', 'a2', 'a3', 'a4']]], 'a2', { edited: new Set(['a1', 'a2', 'a3']) });

    view.columns.value = [['todo', ['a4']]];
    await expect.poll(selectedCard).toBe('a4');
    expect(view.opened).toEqual(['a4']);
});

test('nothing left after the user’s edit: the panel stays, no row is highlighted', async () => {
    const view = await mountOpened([['todo', ['a1']]], 'a1', { edited: new Set(['a1']) });

    view.columns.value = [['todo', []]];
    await expect.poll(selectedCard).toBeNull();
    expect(view.selectedId.value).toBe('a1');
    expect(view.opened).toEqual([]);

    // Something new shows up: the next step reaches it.
    view.columns.value = [['todo', ['b1']]];
    await expect.poll(rowTexts).toEqual(['b1']);
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('b1');
    expect(view.opened).toEqual(['b1']);
});

test('a member of a collapsed stack leaving through the user’s edit: the entry stays and its Enter target opens', async () => {
    const view = await mountOpened(STACKED, 'p3', { edited: new Set(['p3']) });
    await expect.poll(selectedCard).toBe('stack S_1');

    view.columns.value = [['todo', ['a1', { stack: 'S_1', members: ['p1', 'p2'], open: 'p2' }, 'a2']]];
    await expect.poll(() => view.opened).toEqual(['p2']);
    expect(selectedCard()).toBe('stack S_1');
    expect(view.selectedId.value).toBe('p2');
});

test('a stack shrinking to a lone row as the opened member leaves through the user’s edit: the cursor is on that row', async () => {
    const view = await mountOpened(
        [['todo', ['a1', { stack: 'S_1', members: ['p1', 'p2'], open: 'p1' }, 'a2']]],
        'p1',
        { edited: new Set(['p1']) },
    );
    await expect.poll(selectedCard).toBe('stack S_1');

    view.columns.value = [['todo', ['a1', 'p2', 'a2']]];
    await expect.poll(selectedCard).toBe('p2');
    expect(view.opened).toEqual(['p2']);
});

test('the opened item moved into another group is followed, by the user’s edit too, and opens nothing', async () => {
    const view = await mountOpened(BOARD, 'a2', { edited: new Set(['a2']) });

    view.columns.value = [
        ['todo', ['a1', 'a3']],
        ['done', ['a2', 'c1']],
    ];
    await expect.poll(selectedColumn).toBe('done');
    expect(selectedCard()).toBe('a2');
    expect(view.opened).toEqual([]);
});

test('a stack shrinking to a lone row with the remaining member opened is followed, by a sync, not treated as gone', async () => {
    const view = await mountOpened([['todo', ['a1', { stack: 'S_1', members: ['p1', 'p2'], open: 'p1' }, 'a2']]], 'p2');
    await expect.poll(selectedCard).toBe('stack S_1');

    view.columns.value = [['todo', ['a1', 'p2', 'a2']]];
    await expect.poll(selectedCard).toBe('p2');
    expect(view.opened).toEqual([]);
});

test('the opened item leaving another way: no row highlighted, the item stays, the next step goes to the former neighbour', async () => {
    const view = await mountOpened(THREE, 'a2');

    view.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBeNull();
    expect(view.selectedId.value).toBe('a2');
    expect(view.opened).toEqual([]);
    expect(view.listed.at(-1)?.around).toEqual({ previous: 'a1', next: 'a3' });

    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a3');
    expect(view.opened).toEqual(['a3']);
});

test('detached, the previous step goes to the row before where it stood; both clamp at the ends, as around says', async () => {
    const before = await mountOpened(THREE, 'a2');
    before.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBeNull();
    await userEvent.keyboard('k');
    await expect.poll(selectedCard).toBe('a1');
    expect(before.opened).toEqual(['a1']);
    before.unmount();

    const last = await mountOpened(THREE, 'a3');
    last.columns.value = [['todo', ['a1', 'a2']]];
    await expect.poll(selectedCard).toBeNull();
    expect(last.listed.at(-1)?.around).toEqual({ previous: 'a2', next: 'a2' });
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a2');
    last.unmount();

    const first = await mountOpened(THREE, 'a1');
    first.columns.value = [['todo', ['a2', 'a3']]];
    await expect.poll(selectedCard).toBeNull();
    expect(first.listed.at(-1)?.around).toEqual({ previous: 'a2', next: 'a2' });
    await userEvent.keyboard('k');
    await expect.poll(selectedCard).toBe('a2');
});

test('detached, the highlight returns if the row returns, and the steps go from it again', async () => {
    const view = await mountOpened(THREE, 'a2');
    view.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBeNull();

    view.columns.value = THREE;
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual([]);
    expect(view.listed.at(-1)?.around).toEqual({ previous: 'a1', next: 'a3' });

    await userEvent.keyboard('k');
    await expect.poll(selectedCard).toBe('a1');
});

test('closing the panel while detached selects the neighbour, the previous one when none follows', async () => {
    const view = await mountOpened(THREE, 'a2');
    view.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBeNull();

    view.openedId.value = null;
    await expect.poll(selectedCard).toBe('a3');
    expect(view.selectedId.value).toBe('a3');
    expect(view.opened).toEqual([]);
    view.unmount();

    const last = await mountOpened(THREE, 'a3');
    last.columns.value = [['todo', ['a1', 'a2']]];
    await expect.poll(selectedCard).toBeNull();
    last.openedId.value = null;
    await expect.poll(selectedCard).toBe('a2');
});

test('a collapsed group holding the opened item detaches it; expanded again, the highlight returns', async () => {
    const view = await mountOpened(
        [
            ['todo', ['a1', 'a2']],
            ['done', ['b1']],
        ],
        'a2',
    );

    await userEvent.click(page.getByRole('button', { name: /todo/ }));
    await expect.poll(selectedCard).toBeNull();
    expect(view.selectedId.value).toBe('a2');
    expect(view.opened).toEqual([]);
    expect(view.listed.at(-1)?.around).toEqual({ previous: 'b1', next: 'b1' });

    await userEvent.click(page.getByRole('button', { name: /todo/ }));
    await expect.poll(selectedCard).toBe('a2');
});

test('detached, the keys acting on the cursor do nothing and throw nothing', async () => {
    const browser = createSignedInBrowser();
    const open = vi.spyOn(browser, 'openInNewTab');
    const container = createListContainer();
    container.set(Browser, browser);
    const view = await mountOpened(THREE, 'a2', { container });
    view.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBeNull();

    await userEvent.keyboard('xo{ArrowLeft}{ArrowRight}{Shift>}{ArrowRight}{/Shift}{Enter}');
    expect(view.checkedIds.value).toEqual([]);
    expect(open).not.toHaveBeenCalled();
    expect(view.moves).toEqual([]);
    expect(selectedCard()).toBeNull();
    expect(view.selectedId.value).toBe('a2');
});

test('keys running ahead of the opened item: the older item leaving moves nothing', async () => {
    const view = mount(THREE, 'list');
    view.selectedId.value = 'a1';
    view.openedId.value = 'a1';
    await expect.poll(selectedCard).toBe('a1');

    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual(['a2']);

    // The address is still on a1 as it leaves.
    view.columns.value = [['todo', ['a2', 'a3']]];
    await expect.poll(rowTexts).toEqual(['a2', 'a3']);
    await nextTick();
    expect(selectedCard()).toBe('a2');
    expect(view.opened).toEqual(['a2']);
});

test('keys running ahead of the opened item: what they opened leaving through the user’s edit is followed', async () => {
    const view = mount(THREE, 'list', { edited: new Set(['a2']) });
    view.selectedId.value = 'a1';
    view.openedId.value = 'a1';
    await expect.poll(selectedCard).toBe('a1');

    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a2');

    // The address is still on a1 as a2 leaves.
    view.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBe('a3');
    expect(view.opened).toEqual(['a2', 'a3']);
});

test('with an item open, a right-click moves it to the row, the menu acting on that row', async () => {
    const view = await mountOpened(THREE, 'a1', { contextMenu: true });

    await userEvent.click(page.getByText('a2'), { button: 'right' });
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual(['a2']);
    expect(view.openedId.value).toBe('a2');
    await expect.element(page.getByRole('menuitem', { name: 'Open a2' })).toBeVisible();
});

test("with an item open, a right-click on a stack's entry opens what Enter opens there; the menu acts on all of it", async () => {
    const view = await mountOpened(STACKED, 'a1', { contextMenu: true });

    await userEvent.click(page.getByText('stack S_1'), { button: 'right' });
    await expect.poll(selectedCard).toBe('stack S_1');
    expect(view.opened).toEqual(['p2']);
    await expect.element(page.getByRole('menuitem', { name: 'Open p1,p2,p3' })).toBeVisible();
});

test("with an item open, a stack's entry's menu still merges the whole stack, and from the last row moves back", async () => {
    const merging = sampleMerging(['p1', 'p2', 'p3']);
    const view = await mountOpened(
        [['todo', ['a1', { stack: 'S_1', members: ['p1', 'p2', 'p3'], open: 'p2' }]]],
        'a1',
        { merge: merging.context, contextMenu: true },
    );

    await userEvent.click(page.getByText('stack S_1'), { button: 'right' });
    await expect.poll(selectedCard).toBe('stack S_1');
    await userEvent.click(page.getByRole('menuitem', { name: /Merge/u }));
    expect(merging.panels.map(panel => panel.options?.wholeStack)).toEqual([true]);
    expect(merging.panels[0]?.id).toBe('p1');

    merging.panels[0]?.options?.onSent?.([]);
    await expect.poll(selectedCard).toBe('a1');
    expect(view.opened).toEqual(['p2', 'a1']);
});

test('with an item open, a row\'s "Merge" moves it to the row; a right-click among the items edited together moves nothing', async () => {
    const merging = sampleMerging(['a2']);
    const view = await mountOpened(THREE, 'a1', { merge: merging.context, contextMenu: true });

    await userEvent.click(page.getByRole('button', { name: 'Merge a2' }));
    await expect.poll(() => view.selectedId.value).toBe('a2');
    expect(view.opened).toEqual(['a2']);
    expect(merging.panels.map(panel => panel.id)).toEqual(['a2']);

    view.checkedIds.value = ['a1', 'a3'];
    await userEvent.click(page.getByText('a3'), { button: 'right' });
    await expect.element(page.getByRole('menuitem', { name: 'Open a1,a3' })).toBeVisible();
    expect(view.selectedId.value).toBe('a2');
    expect(view.opened).toEqual(['a2']);
});

test('with an item open, a drop moves it to the card dropped; with none open a drop opens nothing', async () => {
    const columns: Columns = [
        ['todo', ['a1', 'a2']],
        ['doing', []],
    ];
    const view = mount(columns, 'board', { followOpened: true });
    view.selectedId.value = 'a1';
    view.openedId.value = 'a1';
    await expect.poll(selectedCard).toBe('a1');

    dropOnDoing();
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual(['a2']);
    view.unmount();

    const closed = mount(columns, 'board');
    dropOnDoing();
    await expect.poll(selectedCard).toBe('a2');
    expect(closed.opened).toEqual([]);

    function dropOnDoing() {
        drag(page.getByText('a2').element().closest('li'), page.getByRole('region', { name: 'doing' }).element());
    }
});

test('with no item open a right-click selects the row and opens nothing', async () => {
    const view = mount(THREE, 'list', { contextMenu: true });

    await userEvent.click(page.getByText('a2'), { button: 'right' });
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual([]);
});

test('with an item open, another row leaving moves nothing', async () => {
    const view = await mountOpened(THREE, 'a2');

    view.columns.value = [['todo', ['a2', 'a3']]];
    await expect.poll(rowTexts).toEqual(['a2', 'a3']);
    await nextTick();
    expect(selectedCard()).toBe('a2');
    expect(view.opened).toEqual([]);
});

test('with an item open the keys pass over a draft, and the steps and neighbours leave it out; with nothing beyond it the cursor stays', async () => {
    const view = await mountOpened([['todo', ['a1', 'd1', 'a2', 'd2']]], 'a1', { canOpenOver: isNoDraft });
    expect(view.listed.at(-1)?.steps).toEqual(['a1', 'a2']);
    expect(view.listed.at(-1)?.around).toEqual({ previous: null, next: 'a2' });

    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual(['a2']);
    expect(view.listed.at(-1)?.around).toEqual({ previous: 'a1', next: null });

    await userEvent.keyboard('{ArrowDown}');
    await nextTick();
    expect(selectedCard()).toBe('a2');
    expect(view.opened).toEqual(['a2']);

    await userEvent.keyboard('k');
    await expect.poll(selectedCard).toBe('a1');
    expect(view.opened).toEqual(['a2', 'a1']);
});

test('board: with an item open ←/→ pass over a column of drafts, and a draft within the column', async () => {
    const view = mount(
        [
            ['todo', ['a1']],
            ['drafts', ['d1']],
            ['done', ['d2', 'b1']],
        ],
        'board',
        { canOpenOver: isNoDraft, followOpened: true },
    );
    view.selectedId.value = 'a1';
    view.openedId.value = 'a1';
    await expect.poll(selectedCard).toBe('a1');

    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(selectedCard).toBe('b1');
    expect(view.opened).toEqual(['b1']);
});

test('with nothing open a draft is an ordinary row: `j` reaches it and Enter opens it; with an item open a click still does', async () => {
    const closed = mount([['todo', ['a1', 'd1']]], 'list', { canOpenOver: isNoDraft });
    await userEvent.keyboard('jj');
    await expect.poll(selectedCard).toBe('d1');
    await userEvent.keyboard('{Enter}');
    expect(closed.opened).toEqual(['d1']);
    closed.unmount();

    const opened = await mountOpened([['todo', ['a1', 'd1', 'a2']]], 'a1', { canOpenOver: isNoDraft });
    await userEvent.click(page.getByText('d1'));
    expect(opened.opened).toEqual(['d1']);
});

test('the opened item leaving through the user’s edit passes over a draft: to the next, else the previous, else it detaches', async () => {
    const edited = new Set(['a1', 'a2', 'a3']);
    const options = { canOpenOver: isNoDraft, edited };

    const next = await mountOpened([['todo', ['a1', 'd1', 'a2']]], 'a1', options);
    next.columns.value = [['todo', ['d1', 'a2']]];
    await expect.poll(selectedCard).toBe('a2');
    expect(next.opened).toEqual(['a2']);
    next.unmount();

    const previous = await mountOpened([['todo', ['a1', 'd1', 'a2', 'd2']]], 'a2', options);
    previous.columns.value = [['todo', ['a1', 'd1', 'd2']]];
    await expect.poll(selectedCard).toBe('a1');
    expect(previous.opened).toEqual(['a1']);
    previous.unmount();

    const alone = await mountOpened([['todo', ['d1', 'a3', 'd2']]], 'a3', options);
    alone.columns.value = [['todo', ['d1', 'd2']]];
    await expect.poll(selectedCard).toBeNull();
    expect(alone.selectedId.value).toBe('a3');
    expect(alone.opened).toEqual([]);
    await userEvent.keyboard('j');
    await nextTick();
    expect(selectedCard()).toBeNull();
    expect(alone.opened).toEqual([]);
});

test('PM32a: a merge sent from the opened item moves on past a draft, the previous one when only drafts follow', async () => {
    const options = { canOpenOver: isNoDraft, merge: sampleMerging([]).context };
    const next = await mountOpened([['todo', ['a1', 'd1', 'a2']]], 'a1', options);
    next.container.resolve(ItemNavigation).requestMoveOn(['a1']);
    await expect.poll(selectedCard).toBe('a2');
    expect(next.opened).toEqual(['a2']);
    next.unmount();

    const previous = await mountOpened([['todo', ['a1', 'd1', 'a2', 'd2']]], 'a2', options);
    previous.container.resolve(ItemNavigation).requestMoveOn(['a2']);
    await expect.poll(selectedCard).toBe('a1');
    expect(previous.opened).toEqual(['a1']);
});

test('detached, the next step passes over a draft', async () => {
    const stepped = await mountOpened([['todo', ['a1', 'a2', 'd1', 'a3']]], 'a2', { canOpenOver: isNoDraft });
    stepped.columns.value = [['todo', ['a1', 'd1', 'a3']]];
    await expect.poll(selectedCard).toBeNull();
    expect(stepped.listed.at(-1)?.around).toEqual({ previous: 'a1', next: 'a3' });
    await userEvent.keyboard('j');
    await expect.poll(selectedCard).toBe('a3');
    expect(stepped.opened).toEqual(['a3']);
});

test('PM32a: a merge sent from the opened item moves on at once, and its later confirmation moves nothing again', async () => {
    const view = await mountOpened(THREE, 'a1', { merge: sampleMerging([]).context });
    view.checkedIds.value = ['a1', 'a3'];
    const navigation = view.container.resolve(ItemNavigation);

    navigation.requestMoveOn(['a1']);
    await expect.poll(selectedCard).toBe('a2');
    expect(view.opened).toEqual(['a2']);
    expect(view.checkedIds.value).toEqual(['a3']);

    // GitHub says it merged: the row leaves, with no edit pending any more.
    view.columns.value = [['todo', ['a2', 'a3']]];
    await expect.poll(rowTexts).toEqual(['a2', 'a3']);
    await nextTick();
    expect(selectedCard()).toBe('a2');
    expect(view.opened).toEqual(['a2']);
});

test('PM32a: past the end, a stack merged whole from its last row moves before the entry; with nothing else, it stays', async () => {
    const view = await mountOpened([['todo', ['a1', { stack: 'S_1', members: ['p1', 'p2'], open: 'p1' }]]], 'p2');
    view.container.resolve(ItemNavigation).requestMoveOn(['p1', 'p2']);
    await expect.poll(selectedCard).toBe('a1');
    expect(view.opened).toEqual(['a1']);
    view.unmount();

    const alone = await mountOpened([['todo', ['a1']]], 'a1');
    alone.container.resolve(ItemNavigation).requestMoveOn(['a1']);
    await nextTick();
    await nextTick();
    expect(selectedCard()).toBe('a1');
    expect(alone.opened).toEqual([]);
});

test('PM32a: a merge from the list with an item open passes all it took, not only the row it was sent from', async () => {
    const merging = sampleMerging(['a3']);
    const view = await mountOpened(THREE, 'a3', { merge: merging.context });
    await userEvent.keyboard('{Shift>}M{/Shift}');

    merging.panels[0]?.options?.onSent?.(['a2', 'a3']);
    await expect.poll(selectedCard).toBe('a1');
    expect(view.opened).toEqual(['a1']);
});

test('PM32a: a merge sent from the list with no item open stays on the last row', async () => {
    const merging = sampleMerging(['a3']);
    const view = mount(THREE, 'list', { merge: merging.context });
    await userEvent.keyboard('jjj');
    await expect.poll(() => view.selectedId.value).toBe('a3');
    await userEvent.keyboard('{Shift>}M{/Shift}');

    merging.panels[0]?.options?.onSent?.([]);
    await nextTick();
    await nextTick();
    expect(view.selectedId.value).toBe('a3');
    expect(view.opened).toEqual([]);
});

test('SP6: a stack’s merge from an opened member moves past what it merged: past the entry when whole, at least a step when not', async () => {
    const whole = await mountOpened(STACKED, 'p2');
    whole.container.resolve(ItemNavigation).requestMoveOn(['p1', 'p2', 'p3']);
    await expect.poll(selectedCard).toBe('a2');
    whole.unmount();

    const part = await mountOpened(STACKED, 'p2');
    part.container.resolve(ItemNavigation).requestMoveOn(['p1', 'p2']);
    await expect.poll(selectedCard).toBe('a2');
    part.unmount();

    // Expanded, on the entry: the rows it merged are passed.
    const expanded = mount(STACKED, 'list', { container: createExpandedContainer('S_1'), followOpened: true });
    await userEvent.keyboard('jj');
    await expect.poll(selectedCard).toBe('stack S_1');
    expanded.openedId.value = 'p2';
    expanded.container.resolve(ItemNavigation).requestMoveOn(['p1', 'p2']);
    await expect.poll(selectedCard).toBe('p3');
});

test('detached, a merge sent from the opened item takes the next step', async () => {
    const view = await mountOpened(THREE, 'a2');
    view.columns.value = [['todo', ['a1', 'a3']]];
    await expect.poll(selectedCard).toBeNull();

    view.container.resolve(ItemNavigation).requestMoveOn(['a2']);
    await expect.poll(selectedCard).toBe('a3');
    expect(view.opened).toEqual(['a3']);
});

/** Mounts the list over `initial`, holding its selection like a page does; every group takes moves. */
function mount(initial: Columns, layout: ListLayout, options: MountOptions = {}) {
    const columns = shallowRef<Columns>(initial);
    const groups = computed(() => columns.value.map(([key, ids]) => toGroup(key, ids)));
    const selectedId = ref<string | null>(null);
    const checkedIds = ref<readonly string[]>([]);
    const openedId = ref<string | null>(null);
    const opened: string[] = [];
    const moves: ListMove[] = [];
    const listed: ListedItems[] = [];

    const container = options.container ?? createListContainer();
    const host = document.createElement('div');
    host.style.height = '100vh';
    host.style.display = 'flex';
    document.body.append(host);

    const app = createApp({
        setup: () => {
            if (options.merge) {
                provideContext(MergeContext, options.merge);
            }

            return () => renderList();
        },
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    let mounted = true;
    onTestFinished(unmount);

    return { columns, selectedId, checkedIds, openedId, opened, moves, listed, unmount, container };

    function renderList() {
        return h(
            ListView<string>,
            {
                groups: groups.value,
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
                isEdited: options.edited && ((id: string) => options.edited?.has(id) ?? false),
                canOpenOver: options.canOpenOver,
                onOpen: (id: string) => {
                    opened.push(id);
                    if (options.followOpened) {
                        openedId.value = id;
                    }
                },
                onMove: (move: ListMove) => moves.push(move),
                onListed: (items: ListedItems) => listed.push(items),
            },
            {
                row: ({ entry, stack, checked, halfChecked }: RowProps) =>
                    stack
                        ? h('span', `stack ${stack.id}${getMark(checked, halfChecked)}`)
                        : h('span', [entry.value, h(MergeButton, { id: entry.id })]),
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
                                                'aria-current': props.selectedMember === member.id ? 'true' : undefined,
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
                    contextMenu: ({ ids, open, merge }: ListContextMenuProps) => [
                        h(DropdownMenuItem, { onSelect: open }, () => `Open ${ids.join(',')}`),
                        merge && h(DropdownMenuItem, { onSelect: () => void merge.run?.() }, () => merge.title),
                    ],
                }),
            },
        );
    }

    function unmount() {
        if (mounted) {
            mounted = false;
            app.unmount();
            host.remove();
        }
    }
}

/** The app's services a list reads: the local copy, of a signed-in user, kept in IndexedDB as the app keeps it. */
function createListContainer(request?: BrowserShape['fetch']) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser(request));
    setIndexedDbPersistence(container);
    return container;
}

/** {@link createListContainer}'s, with the stacks expanded as a session may have left them. */
function createExpandedContainer(...stacks: readonly string[]) {
    const container = createListContainer();
    for (const stack of stacks) {
        container.resolve(ExpandedStacks).set(stack, true);
    }

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
        description: row.description ?? {
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
    const entry: ListRow<string> = {
        key: `${group}:${id}`,
        id,
        value: row.open,
        nested: row.members.map(member => ({ key: `${group}:${member}`, id: member, value: member })),
        stack,
    };
    return row.header
        ? { key: `${group}:${row.header}`, id: row.header, value: row.header, nested: [], stacks: [entry] }
        : entry;
}

/** The rows named "d…" stand for a project's drafts. */
function isNoDraft(value: string) {
    return !value.startsWith('d');
}

/** Presses `j` `times`, one key at a time; what is highlighted after each. */
function walkDown(times: number) {
    return walk('j', times);
}

/** {@link walkDown} with `k`. */
function walkUp(times: number) {
    return walk('k', times);
}

async function walk(key: string, times: number) {
    const highlighted: (string | null)[] = [];
    for (let press = 0; press < times; press++) {
        await userEvent.keyboard(key);
        await nextTick();
        highlighted.push(selectedCard());
    }

    return highlighted;
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
