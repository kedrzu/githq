import { expect, mock, test } from 'bun:test';

import { sampleIssue } from '@/testing/sampleItems.js';

import { buildCommandMenu, resolveMenuPath } from './buildCommandMenu.js';
import type { BuildCommandMenuParams, CommandMenuEntry, CommandMenuGroup } from './buildCommandMenu.js';
import type { Command, CommandSubject } from './CommandTypes.js';
import type { NavigationData, NavigationPlace } from './searchNavigation.js';

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

test('a search is offered as an action, but its answers are not looked through or asked for from the top level', () => {
    const search = mock(() => undefined);
    const options = mock(() => ({
        options: [{ value: 'vitejs/vite', label: 'vitejs/vite', pick: () => undefined }],
    }));
    const searching: Command = {
        id: 'app.searchRepositories',
        title: 'Search repositories…',
        section: 'app',
        options,
        search,
    };

    const found = (query: string) =>
        ids(buildCommandMenu({ query, commands: [searching], subject: null, repository: null, navigation: NOTHING }));

    expect(found('vitejs')).toEqual([]);
    expect(found('search rep')).toEqual(['app.searchRepositories']);
    expect(options).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
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
        places: [{ id: 'a', group: 'goTo', kind: 'settings', title: 'Account', path: '/account' }],
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

const REPOSITORY_ROW: Command = { id: 'pulls', title: 'Pull requests', section: 'repository' };
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

const VIEW_PROPERTIES: Command = {
    id: 'view.properties',
    title: 'Show properties',
    section: 'view',
    options: () => ({ options: [{ value: 'status', label: 'Pull request status', pick: () => undefined }] }),
};
const MY_PULLS = place('pulls', 'My pull requests');
const SWITCH: Command = { id: 'stable', title: 'Switch to Stable', section: 'app', run: () => undefined };
const UPDATES: Command = { id: 'updates', title: 'Updates', section: 'app', children: () => [SWITCH] };
const SYNC: Command = { id: 'sync', title: 'Sync', section: 'app', run: () => undefined };
const SETTINGS: NavigationPlace = { ...place('settings', 'Settings'), children: () => [SYNC, UPDATES] };

test('"pull" off a repository: a nested option ranks below a place outside the context', () => {
    const menu = build({ query: 'pull', commands: [VIEW_PROPERTIES], navigation: { ...NOTHING, places: [MY_PULLS] } });

    expect(menu.map(group => group.key)).toEqual(['goTo', 'view']);
    expect(score(menu, 'place:pulls')).toBeCloseTo(54);
    expect(score(menu, 'view.properties:status')).toBeCloseTo(48);
});

test('"pull" on a repository\'s screen: its own action leads, unpenalized', () => {
    const menu = build({
        query: 'pull',
        commands: [REPOSITORY_PULLS],
        repository: 'acme/web',
        navigation: { ...NOTHING, places: [MY_PULLS] },
    });

    expect(ids(menu)).toEqual(['repository.pullRequests', 'place:pulls']);
    expect(score(menu, 'repository.pullRequests')).toBe(80);
    expect(score(menu, 'place:pulls')).toBeCloseTo(54);
});

test("\"settings\" on a repository's screen: the app's Settings above the repository's, and no child of it listed", () => {
    const repositorySettings: Command = {
        id: 'repository.settings',
        title: 'Repository settings',
        section: 'repository',
    };
    const menu = build({
        query: 'settings',
        commands: [repositorySettings],
        repository: 'acme/web',
        navigation: { ...NOTHING, places: [SETTINGS] },
    });

    expect(ids(menu)).toEqual(['place:settings', 'repository.settings']);
    expect(score(menu, 'place:settings')).toBeCloseTo(90);
    expect(score(menu, 'repository.settings')).toBe(60);
});

test('everything outside the context pays for it: an item, a repository not tracked, an app action', () => {
    const menu = build({
        query: 'acme/foo',
        commands: [{ id: 'app.foo', title: 'acme/foo', section: 'app' }],
        navigation: { ...NOTHING, items: [{ ...sampleIssue('i'), title: 'acme/foo' }] },
    });

    expect(score(menu, 'item:i')).toBeCloseTo(90);
    expect(score(menu, 'repository:acme/foo')).toBeCloseTo(90);
    expect(score(menu, 'app.foo')).toBeCloseTo(90);
});

test('words name the ancestors from the start: "web pull" finds a repository\'s row, "pull web" does not', () => {
    const navigation = { ...NOTHING, places: [repositoryPlace('acme/web')] };
    const menu = build({ query: 'web pull', navigation });
    const id = 'place:repository:acme/web/pulls';

    expect(menu.map(group => group.key)).toEqual(['repositories']);
    expect(ids(menu)).toEqual([id]);
    expect(score(menu, id)).toBeCloseTo(57.6);
    expect(findEntry(menu, id)?.ancestors).toEqual([{ title: 'acme/web', ranges: [5, 8] }]);
    expect(ids(build({ query: 'pull web', navigation }))).toEqual([]);
});

test('typing just "pull" computes no repository\'s children; naming one computes only its', () => {
    const web = mock(() => [REPOSITORY_ROW]);
    const api = mock(() => [REPOSITORY_ROW]);
    const repositoryChildren = mock(() => [REPOSITORY_ROW]);
    const navigation: NavigationData = {
        ...NOTHING,
        places: [
            { ...repositoryPlace('acme/web'), children: web },
            { ...repositoryPlace('acme/api'), children: api },
        ],
        repositoryChildren,
    };

    expect(ids(build({ query: 'pull', navigation }))).toEqual([]);
    expect(web).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
    expect(repositoryChildren).not.toHaveBeenCalled();

    expect(ids(build({ query: 'web pull', navigation }))).toEqual(['place:repository:acme/web/pulls']);
    expect(web).toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
    expect(repositoryChildren).not.toHaveBeenCalled();
});

test('text wholly naming a parent shows its own row, not its children', () => {
    const navigation = { ...NOTHING, places: [repositoryPlace('acme/web')], trackedRepositories: ['acme/web'] };

    expect(ids(build({ query: 'acme/web', navigation }))).toEqual(['place:repository:acme/web']);
});

test('deep rows pay per level unnamed, and less for a level named', () => {
    const navigation = { ...NOTHING, places: [SETTINGS] };
    const id = 'place:settings/updates/stable';
    const unnamed = { title: 'Settings', ranges: null };

    const whole = build({ query: 'switch to stable', navigation });
    expect(score(whole, id)).toBeCloseTo(32.4);
    expect(findEntry(whole, id)?.ancestors).toEqual([unnamed, { title: 'Updates', ranges: null }]);

    // 21.6 passes the cut before the context's cost, 19.44 after it.
    expect(score(build({ query: 'stable', navigation }), id)).toBeCloseTo(19.44);

    const parent = build({ query: 'settings stable', navigation });
    expect(score(parent, id)).toBeCloseTo(32.4);
    expect(findEntry(parent, id)?.ancestors).toEqual([
        { title: 'Settings', ranges: [0, 8] },
        { title: 'Updates', ranges: null },
    ]);

    expect(score(build({ query: 'settings updates stable', navigation }), id)).toBeCloseTo(54);
});

test('a nested row below the cut, or matching only weakly, is not shown; a row at the top is', () => {
    const deepest: Command = { id: 'deepest', title: 'Deepest', section: 'app' };
    const level3: Command = { id: 'c', title: 'Level', section: 'app', children: () => [deepest] };
    const level2: Command = { id: 'b', title: 'Level', section: 'app', children: () => [level3] };
    const level1: NavigationPlace = { ...place('a', 'Level'), children: () => [level2] };
    const navigation = { ...NOTHING, places: [level1] };

    // 100 × 0.6³ passes, 80 × 0.6³ does not.
    expect(ids(build({ query: 'deepest', navigation }))).toEqual(['place:a/b/c/deepest']);
    expect(ids(build({ query: 'deepes', navigation }))).toEqual([]);

    const updates = { ...NOTHING, places: [SETTINGS] };
    // In the middle of a word, or scattered letters: found at the top, never through a level.
    expect(ids(build({ query: 'witch', navigation: updates }))).toEqual([]);
    expect(ids(build({ query: 'swtb', navigation: updates }))).toEqual([]);
    expect(ids(build({ query: 'swtb', commands: [SWITCH] }))).toEqual(['stable']);
});

test('scattered letters do not name an ancestor', () => {
    const navigation = { ...NOTHING, places: [repositoryPlace('acme/web')] };

    expect(ids(build({ query: 'amw', navigation }))).toEqual(['place:repository:acme/web']);
    expect(ids(build({ query: 'amw pull', navigation }))).toEqual([]);
});

test('"in prog" on an opened item finds a status value above item titles; "status in prog" names the action', () => {
    const navigation = { ...NOTHING, items: [{ ...sampleIssue('i'), title: 'Fixing what is in progress' }] };
    const menu = build({ query: 'in prog', commands: [STATUS], subject: ITEM, navigation });
    const id = 'item.status:In progress';

    expect(menu[0]?.key).toBe('subject');
    expect(score(menu, id)).toBeCloseTo(64);
    expect(findEntry(menu, id)?.ancestors).toEqual([{ title: 'Set status…', ranges: null }]);

    const named = build({ query: 'status in prog', commands: [STATUS], subject: ITEM });
    expect(ids(named)).toEqual([id]);
    expect(score(named, id)).toBeCloseTo(64);
    expect(findEntry(named, id)?.ancestors).toEqual([{ title: 'Set status…', ranges: [4, 10] }]);
    expect(findEntry(named, id)?.path).toEqual(['item.status']);
});

test('the limit of options holds across the ways of finding them, and two letters are what the option gets', () => {
    const review: Command = {
        id: 'view.review',
        title: 'Review stage',
        section: 'view',
        options: () => ({
            options: ['Review stage 1', 'Review stage 2', 'Stage 3', 'Stage 4'].map(label => ({
                value: label,
                label,
                pick: () => undefined,
            })),
        }),
    };

    expect(ids(build({ query: 'review stage', commands: [review] }))).toEqual([
        'view.review',
        'view.review:Stage 3',
        'view.review:Stage 4',
        'view.review:Review stage 1',
    ]);
    expect(ids(build({ query: 'status in', commands: [STATUS], subject: ITEM }))).toEqual(['item.status:In progress']);
    expect(ids(build({ query: 'status i', commands: [STATUS], subject: ITEM }))).toEqual([]);
});

test('a search nested in a level is not asked for its answers either', () => {
    const options = mock(() => ({ options: [{ value: 'hit', label: 'Hit', pick: () => undefined }] }));
    const searching: Command = {
        id: 'search',
        title: 'Search',
        section: 'app',
        options,
        search: () => undefined,
    };
    const navigation = { ...NOTHING, places: [{ ...place('p', 'Parent'), children: () => [searching] }] };

    expect(ids(build({ query: 'hit', navigation }))).toEqual([]);
    expect(ids(build({ query: 'parent hit', navigation }))).toEqual([]);
    expect(ids(build({ query: 'parent search hit', navigation }))).toEqual([]);
    expect(options).not.toHaveBeenCalled();
});

test('a project is found by its saved views alone, by its actions only when named', () => {
    const board: Command = { id: 'board', title: 'Board', section: 'app' };
    const copy: Command = { id: 'copy', title: 'Copy link', section: 'app' };
    const project: NavigationPlace = {
        ...place('p', 'Platform Q4', 'projects'),
        children: () => [board, copy],
        foundAlone: () => [board],
    };
    const navigation = { ...NOTHING, places: [project] };

    expect(ids(build({ query: 'board', navigation }))).toEqual(['place:p/board']);
    expect(ids(build({ query: 'copy', navigation }))).toEqual([]);
    expect(ids(build({ query: 'platform copy', navigation }))).toEqual(['place:p/copy']);
});

test('`>` finds nested actions but no place or item; `#123` finds neither', () => {
    const signOut: Command = { id: 'out', title: 'Sign 12', section: 'app' };
    const signPlace: NavigationPlace = { ...place('sign', 'Sign 12'), children: () => [signOut] };
    const navigation: NavigationData = {
        ...NOTHING,
        places: [signPlace],
        items: [{ ...sampleIssue('i'), title: 'Sign 12', number: 12 }],
    };

    expect(ids(build({ query: 'sign', navigation })).toSorted()).toEqual(['item:i', 'place:sign', 'place:sign/out']);
    expect(ids(build({ query: '> sign', navigation }))).toEqual(['place:sign/out']);
    expect(ids(build({ query: '#12', navigation }))).toEqual(['item:i']);
});

test('a nested row answers to its own `menu` and `when`, not to the section checks of the top level', () => {
    const itemRow: Command = { id: 'row', title: 'Rename', section: 'item' };
    const hidden: Command = { ...itemRow, id: 'gone', when: () => false };
    const keysOnly: Command = { ...itemRow, id: 'keys', menu: false };
    const navigation = {
        ...NOTHING,
        places: [{ ...place('p', 'Parent'), children: () => [itemRow, hidden, keysOnly] }],
    };

    expect(ids(build({ query: 'rename', navigation }))).toEqual(['place:p/row']);
});

test('an untracked `owner/name` typed gives its children with it named; a tracked one is not looked up so', () => {
    const repositoryChildren = mock(() => [REPOSITORY_ROW]);
    const navigation: NavigationData = { ...NOTHING, trackedRepositories: ['acme/web'], repositoryChildren };
    const menu = build({ query: 'acme/foo pull', navigation });
    const id = 'repository:acme/foo/pulls';

    expect(menu.map(group => group.key)).toEqual(['repositories']);
    expect(ids(menu)).toEqual([id]);
    expect(score(menu, id)).toBeCloseTo(72);
    expect(findEntry(menu, id)?.ancestors).toEqual([{ title: 'acme/foo', ranges: [0, 4, 5, 8] }]);
    expect(repositoryChildren).toHaveBeenCalledWith('acme/foo');

    repositoryChildren.mockClear();
    const alone = build({ query: 'acme/foo', navigation });
    expect(ids(alone)).toEqual(['repository:acme/foo']);
    expect(findEntry(alone, 'repository:acme/foo')?.path).toEqual(['repository:acme/foo']);
    expect(ids(build({ query: 'acme/web pull', navigation }))).toEqual([]);
    expect(repositoryChildren).not.toHaveBeenCalled();
});

test('inside a submenu: only its rows, at their full value, deeper ones still paying for their level', () => {
    const navigation = { ...NOTHING, places: [SETTINGS, MY_PULLS] };
    const steps = resolveMenuPath({ path: ['place:settings'], commands: [], navigation });
    const level = steps.at(-1);

    const listed = build({ query: '', commands: [SIDEBAR], navigation, level });
    expect(listed.map(group => group.key)).toEqual(['level']);
    expect(ids(listed)).toEqual(['place:settings/sync', 'place:settings/updates']);
    expect(findEntry(listed, 'place:settings/updates')?.path).toEqual(['place:settings', 'place:settings/updates']);
    expect(findEntry(listed, 'place:settings/sync')?.path).toEqual(['place:settings']);

    const direct = build({ query: 'updates', navigation, level });
    expect(score(direct, 'place:settings/updates')).toBe(100);

    // Its own rows are the level's top: found by scattered letters too, not cut.
    expect(ids(build({ query: 'uds', navigation, level }))).toEqual(['place:settings/updates']);

    const deeper = build({ query: 'switch to stable', navigation, level });
    expect(ids(deeper)).toEqual(['place:settings/updates/stable']);
    expect(score(deeper, 'place:settings/updates/stable')).toBeCloseTo(60);
    expect(findEntry(deeper, 'place:settings/updates/stable')?.ancestors).toEqual([{ title: 'Updates', ranges: null }]);
    expect(findEntry(deeper, 'place:settings/updates/stable')?.path).toEqual([
        'place:settings',
        'place:settings/updates',
    ]);
});

test('a path walks from a command, a place or an untracked repository to the last level still there', () => {
    const navigation: NavigationData = {
        ...NOTHING,
        places: [SETTINGS],
        repositoryChildren: name => [{ ...REPOSITORY_ROW, title: `Pulls of ${name}`, children: () => [] }],
    };
    const titles = (path: readonly string[], commands: readonly Command[] = []) =>
        resolveMenuPath({ path, commands, navigation }).map(step => step.title);
    const updatesPath = ['place:settings', 'place:settings/updates'];
    const [, updates] = resolveMenuPath({ path: updatesPath, commands: [], navigation });

    expect(titles(updatesPath)).toEqual(['Settings', 'Updates']);
    expect(updates?.command).toBe(UPDATES);
    expect(updates?.rows).toEqual([SWITCH]);
    expect(updates?.path).toEqual(updatesPath);

    expect(titles(['repository:acme/foo', 'repository:acme/foo/pulls'])).toEqual(['acme/foo', 'Pulls of acme/foo']);
    expect(titles(['item.status'], [STATUS])).toEqual(['Set status…']);

    // Gone: an unknown level, a child that has no submenu, a root whose `when` says no.
    expect(titles([...updatesPath, 'place:settings/updates/stable'])).toEqual(['Settings', 'Updates']);
    expect(titles(['place:settings', 'place:settings/nope', 'place:settings/updates'])).toEqual(['Settings']);
    expect(titles(['item.status'], [{ ...STATUS, when: () => false }])).toEqual([]);
    expect(titles(['place:nope'])).toEqual([]);
    expect(
        resolveMenuPath({
            path: updatesPath,
            commands: [],
            navigation: {
                ...navigation,
                places: [{ ...SETTINGS, children: () => [{ ...UPDATES, when: () => false }] }],
            },
        }).map(step => step.title),
    ).toEqual(['Settings']);
});

function build(params: Partial<BuildCommandMenuParams>) {
    return buildCommandMenu({
        query: '',
        commands: [],
        subject: null,
        repository: null,
        navigation: NOTHING,
        ...params,
    });
}

function findEntry(groups: readonly CommandMenuGroup[], id: string): CommandMenuEntry | undefined {
    return groups.flatMap(group => group.entries).find(candidate => candidate.id === id);
}

function score(groups: readonly CommandMenuGroup[], id: string) {
    return findEntry(groups, id)?.score;
}

function place(id: string, title: string, group: NavigationPlace['group'] = 'goTo'): NavigationPlace {
    return { id, group, kind: 'myWork', title, path: '/' };
}

function repositoryPlace(name: string): NavigationPlace {
    return {
        id: `repository:${name}`,
        group: 'repositories',
        kind: 'repository',
        title: name,
        path: `/${name}`,
        children: () => [REPOSITORY_ROW],
        foundAlone: () => [],
    };
}
