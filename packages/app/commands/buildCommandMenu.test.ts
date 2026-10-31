import { expect, test } from 'bun:test';

import { buildCommandMenu } from './buildCommandMenu.js';
import type { CommandMenuGroup } from './buildCommandMenu.js';
import type { Command, CommandSubject } from './CommandTypes.js';
import type { NavigationData } from './searchNavigation.js';

const NOTHING: NavigationData = { places: [], trackedRepositories: [], items: [] };
const ITEM: CommandSubject = { kind: 'item', label: 'portal#1187', title: 'Calendar' };
const SELECTION: CommandSubject = { kind: 'selection', label: '3 items', title: '3 items' };

const STATUS: Command = {
    id: 'item.status',
    title: 'Set status…',
    section: 'item',
    options: () => ({
        options: ['Todo', 'In progress', 'Done'].map(label => ({ value: label, label, pick: () => undefined })),
    }),
};
const SELECTION_ASSIGN: Command = { id: 'selection.assignees', title: 'Assign to…', section: 'selection' };
const SIDEBAR: Command = { id: 'app.sidebar', title: 'Collapse sidebar', section: 'app', key: '[' };
const KEYS_ONLY: Command = { id: 'app.commandMenu', title: 'Open the command menu', section: 'app', menu: false };

test("the subject's actions are offered for their subject only, none once it is taken out", () => {
    const commands = [STATUS, SELECTION_ASSIGN, SIDEBAR, KEYS_ONLY];

    expect(ids(buildCommandMenu({ query: '', commands, subject: ITEM, navigation: NOTHING }))).toEqual([
        'item.status',
        'app.sidebar',
    ]);
    expect(ids(buildCommandMenu({ query: '', commands, subject: SELECTION, navigation: NOTHING }))).toEqual([
        'selection.assignees',
        'app.sidebar',
    ]);
    expect(ids(buildCommandMenu({ query: '', commands, subject: null, navigation: NOTHING }))).toEqual(['app.sidebar']);
});

test('E4: a value of a submenu typed is offered directly, above its action; scattered letters are not', () => {
    const menu = buildCommandMenu({
        query: 'in prog',
        commands: [STATUS, SIDEBAR],
        subject: ITEM,
        navigation: NOTHING,
    });

    expect(ids(menu)).toEqual(['item.status:In progress']);
    expect(ids(buildCommandMenu({ query: 'ipg', commands: [STATUS], subject: ITEM, navigation: NOTHING }))).toEqual([]);
});

test('typed text puts the heading with the best match first', () => {
    const menu = buildCommandMenu({
        query: 'collapse',
        commands: [STATUS, SIDEBAR],
        subject: ITEM,
        navigation: {
            ...NOTHING,
            places: [{ id: 'x', group: 'goTo', kind: 'myWork', title: 'My collapse list', path: '/' }],
        },
    });

    expect(menu.map(group => group.key)).toEqual(['app', 'goTo']);
});

test('an action whose `when` says no is not offered', () => {
    const hidden: Command = { ...SIDEBAR, when: () => false };

    expect(ids(buildCommandMenu({ query: '', commands: [hidden], subject: ITEM, navigation: NOTHING }))).toEqual([]);
});

function ids(groups: readonly CommandMenuGroup[]) {
    return groups.flatMap(group => group.entries.map(entry => entry.id));
}

test('E1: typed after `>`, only actions are found — no places or items', () => {
    const navigation: NavigationData = {
        places: [{ id: 'my', group: 'goTo', kind: 'myWork', title: 'Collapse sidebar notes', path: '/' }],
        trackedRepositories: [],
        items: [],
    };
    const commands = [SIDEBAR];

    expect(ids(buildCommandMenu({ query: 'collapse', commands, subject: ITEM, navigation }))).toEqual(
        expect.arrayContaining(['app.sidebar', 'place:my']),
    );
    expect(ids(buildCommandMenu({ query: '> collapse', commands, subject: ITEM, navigation }))).toEqual([
        'app.sidebar',
    ]);
    expect(ids(buildCommandMenu({ query: '>', commands, subject: ITEM, navigation }))).toEqual(['app.sidebar']);
});
