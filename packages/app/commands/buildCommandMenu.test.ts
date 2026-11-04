import { expect, test } from 'bun:test';

import { sampleIssue } from '@/testing/sampleItems.js';

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

    expect(
        ids(buildCommandMenu({ query: '', commands, subject: ITEM, repository: null, navigation: NOTHING })),
    ).toEqual(['item.status', 'app.sidebar']);
    expect(
        ids(buildCommandMenu({ query: '', commands, subject: SELECTION, repository: null, navigation: NOTHING })),
    ).toEqual(['selection.assignees', 'app.sidebar']);
    expect(
        ids(buildCommandMenu({ query: '', commands, subject: null, repository: null, navigation: NOTHING })),
    ).toEqual(['app.sidebar']);
});

test('E4: a value of a submenu typed is offered directly, above its action; scattered letters are not', () => {
    const menu = buildCommandMenu({
        query: 'in prog',
        commands: [STATUS, SIDEBAR],
        subject: ITEM,
        repository: null,
        navigation: NOTHING,
    });

    expect(ids(menu)).toEqual(['item.status:In progress']);
    expect(
        ids(
            buildCommandMenu({
                query: 'ipg',
                commands: [STATUS],
                subject: ITEM,
                repository: null,
                navigation: NOTHING,
            }),
        ),
    ).toEqual([]);
});

test('E4: options are found from two letters on, at most 3 per action, the best first', () => {
    const many: Command = {
        ...STATUS,
        options: () => ({
            options: ['Review later', 'Review', 'Review soon', 'Review now', 'Reviewed'].map(label => ({
                value: label,
                label,
                pick: () => undefined,
            })),
        }),
    };

    expect(
        ids(buildCommandMenu({ query: 'i', commands: [STATUS], subject: ITEM, repository: null, navigation: NOTHING })),
    ).toEqual([]);
    expect(
        ids(
            buildCommandMenu({ query: 'in', commands: [STATUS], subject: ITEM, repository: null, navigation: NOTHING }),
        ),
    ).toEqual(['item.status:In progress']);
    expect(
        ids(
            buildCommandMenu({
                query: 'review',
                commands: [many],
                subject: ITEM,
                repository: null,
                navigation: NOTHING,
            }),
        ),
    ).toEqual(['item.status:Review', 'item.status:Review later', 'item.status:Review soon']);
});

test('E4: an option is found directly with a typo at a word start, not elsewhere in a word', () => {
    expect(
        ids(
            buildCommandMenu({
                query: 'progrss',
                commands: [STATUS],
                subject: ITEM,
                repository: null,
                navigation: NOTHING,
            }),
        ),
    ).toEqual(['item.status:In progress']);
    expect(
        ids(
            buildCommandMenu({
                query: 'rogrss',
                commands: [STATUS],
                subject: ITEM,
                repository: null,
                navigation: NOTHING,
            }),
        ),
    ).toEqual([]);
});

test('entries carry what the menu marks: a title, a hidden word, an option, a place, an item', () => {
    const newIssue: Command = { id: 'app.new', title: 'New issue', section: 'app', keywords: ['create'] };
    const navigation: NavigationData = {
        places: [{ id: 'a', group: 'goTo', kind: 'account', title: 'Account', path: '/account' }],
        trackedRepositories: [],
        items: [{ ...sampleIssue('i'), title: 'Account page' }],
    };

    expect(find('sts', [STATUS])).toEqual({ field: 'title', text: 'Set status…', ranges: [0, 1, 2, 3, 4, 5] });
    expect(find('creat', [newIssue])).toEqual({ field: 'hidden', text: 'create', ranges: [0, 5] });
    expect(find('in prog', [STATUS])).toEqual({ field: 'title', text: 'In progress', ranges: [0, 2, 3, 7] });
    expect(
        buildCommandMenu({ query: 'account', commands: [], subject: null, repository: null, navigation })
            .flatMap(group => group.entries)
            .map(entry =>
                entry.kind === 'navigation' && entry.result.kind !== 'repository' ? entry.result.match : null,
            ),
    ).toEqual([
        { field: 'title', text: 'Account', ranges: [0, 7] },
        { field: 'title', text: 'Account page', ranges: [0, 7] },
    ]);

    function find(query: string, commands: readonly Command[]) {
        const entry = buildCommandMenu({ query, commands, subject: ITEM, repository: null, navigation: NOTHING })[0]
            ?.entries[0];
        return entry?.kind === 'command' || entry?.kind === 'option' ? entry.match : null;
    }
});

test('a scattered action ranks below a heading holding the words themselves', () => {
    const menu = buildCommandMenu({
        query: 'cls',
        commands: [SIDEBAR],
        subject: ITEM,
        repository: null,
        navigation: {
            ...NOTHING,
            places: [{ id: 'x', group: 'goTo', kind: 'myWork', title: 'cls', path: '/' }],
        },
    });

    expect(menu.map(group => group.key)).toEqual(['goTo', 'app']);
});

test('`#123` finds items only: no action, option or place holding the digits, even with no such item', () => {
    const sprint: Command = {
        id: 'item.iteration',
        title: 'Set iteration 1187',
        section: 'item',
        options: () => ({ options: [{ value: 'x', label: 'Sprint 1187', pick: () => undefined }] }),
    };
    const navigation: NavigationData = {
        ...NOTHING,
        places: [{ id: 'x', group: 'goTo', kind: 'myWork', title: 'Sprint 1187', path: '/' }],
    };
    const menu = buildCommandMenu({
        query: '#1187',
        commands: [sprint],
        subject: ITEM,
        repository: null,
        navigation: { ...navigation, items: [{ ...sampleIssue('i'), number: 1187 }] },
    });
    const [first] = menu[0]?.entries ?? [];

    expect(ids(menu)).toEqual(['item:i']);
    expect(first?.kind === 'navigation' && first.result.kind === 'item' ? first.result.match.field : null).toBe(
        'reference',
    );
    expect(
        buildCommandMenu({ query: '#1187', commands: [sprint], subject: ITEM, repository: null, navigation }),
    ).toEqual([]);
    expect(
        ids(buildCommandMenu({ query: '1187', commands: [sprint], subject: ITEM, repository: null, navigation })),
    ).toEqual(expect.arrayContaining(['item.iteration', 'item.iteration:x', 'place:x']));
});

test('E4: a long list of options finds its first hits only', () => {
    const options = Array.from({ length: 1200 }, (_, index) => ({
        value: `${index}`,
        label: index === 1100 ? 'Hydrate' : `Hydrate ${index}`,
        pick: () => undefined,
    }));
    const long: Command = { id: 'view.add', title: 'Add items', section: 'view', options: () => ({ options }) };

    expect(
        ids(
            buildCommandMenu({
                query: 'hydrate',
                commands: [long],
                subject: null,
                repository: null,
                navigation: NOTHING,
            }),
        ),
    ).toEqual(['view.add:0', 'view.add:1', 'view.add:2']);
});

test('nothing typed lists every action and place in the fixed order, unmarked', () => {
    const menu = buildCommandMenu({
        query: '',
        commands: [SIDEBAR, STATUS],
        subject: ITEM,
        repository: null,
        navigation: {
            ...NOTHING,
            places: [{ id: 'x', group: 'goTo', kind: 'myWork', title: 'My work', path: '/' }],
        },
    });

    expect(menu.map(group => group.key)).toEqual(['subject', 'goTo', 'app']);
    for (const entry of menu.flatMap(group => group.entries)) {
        expect(
            entry.kind === 'navigation' && entry.result.kind !== 'repository' ? entry.result.match : null,
        ).toBeNull();
        expect(entry.kind === 'command' ? entry.match : null).toBeNull();
    }
});

test('typed text puts the heading with the best match first', () => {
    const menu = buildCommandMenu({
        query: 'collapse',
        commands: [STATUS, SIDEBAR],
        subject: ITEM,
        repository: null,
        navigation: {
            ...NOTHING,
            places: [{ id: 'x', group: 'goTo', kind: 'myWork', title: 'My collapse list', path: '/' }],
        },
    });

    expect(menu.map(group => group.key)).toEqual(['app', 'goTo']);
});

test('an action whose `when` says no is not offered', () => {
    const hidden: Command = { ...SIDEBAR, when: () => false };

    expect(
        ids(buildCommandMenu({ query: '', commands: [hidden], subject: ITEM, repository: null, navigation: NOTHING })),
    ).toEqual([]);
});

test("the repository's sections lead its group on its view, though the view registers them after its other lines", () => {
    const link: Command = { id: 'repository.copyLink', title: 'Copy link', section: 'repository' };
    const section: Command = { id: 'repository.section.issues', title: 'Issues', section: 'repository', key: '1' };

    expect(
        ids(
            buildCommandMenu({
                query: '',
                commands: [link, section],
                subject: null,
                repository: 'acme/web',
                navigation: NOTHING,
            }),
        ),
    ).toEqual(['repository.section.issues', 'repository.copyLink']);
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

    expect(ids(buildCommandMenu({ query: 'collapse', commands, subject: ITEM, repository: null, navigation }))).toEqual(
        expect.arrayContaining(['app.sidebar', 'place:my']),
    );
    expect(
        ids(buildCommandMenu({ query: '> collapse', commands, subject: ITEM, repository: null, navigation })),
    ).toEqual(['app.sidebar']);
    expect(ids(buildCommandMenu({ query: '>', commands, subject: ITEM, repository: null, navigation }))).toEqual([
        'app.sidebar',
    ]);
});

const REPOSITORY_PULLS: Command = {
    id: 'repository.pullRequests',
    title: 'Pull requests',
    section: 'repository',
    key: 'G',
};

test('a repository action is offered only with a repository, under its own group before "Go to"', () => {
    const commands = [REPOSITORY_PULLS, SIDEBAR];
    const menu = buildCommandMenu({
        query: '',
        commands,
        subject: null,
        repository: 'acme/web',
        navigation: { ...NOTHING, places: [{ id: 'x', group: 'goTo', kind: 'myWork', title: 'My work', path: '/' }] },
    });

    expect(menu.map(group => group.key)).toEqual(['repository', 'goTo', 'app']);
    expect(ids(menu)).toEqual(['repository.pullRequests', 'place:x', 'app.sidebar']);
    expect(
        ids(buildCommandMenu({ query: '', commands, subject: ITEM, repository: null, navigation: NOTHING })),
    ).toEqual(['app.sidebar']);
});

test('typing "pull" ranks the repository group above a tied "Go to" place of the same name', () => {
    const menu = buildCommandMenu({
        query: 'pull',
        commands: [REPOSITORY_PULLS],
        subject: null,
        repository: 'acme/web',
        navigation: {
            ...NOTHING,
            places: [{ id: 'x', group: 'goTo', kind: 'myWork', title: 'Pull requests', path: '/' }],
        },
    });

    expect(menu.map(group => group.key)).toEqual(['repository', 'goTo']);
});
