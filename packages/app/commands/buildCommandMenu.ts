import { assertNever } from '@nzyme/utils/assertNever.js';

import { findOptionLabels } from '@/components/filterOptions.js';

import type { Command, CommandOption, CommandSection, CommandSubject } from './CommandTypes.js';
import { findMenuRows } from './findMenuRows.js';
import type { CommandMenuMatch, MenuRowTexts } from './findMenuRows.js';
import { findUntrackedRepository, isOnlyItemNumber, searchNavigation } from './searchNavigation.js';
import type { NavigationData, NavigationGroup, NavigationPlace, NavigationResult } from './searchNavigation.js';

/** What a row found deeper marks in one of the levels above it. */
export interface CommandMenuAncestor {
    readonly title: string;
    /** The parts of `title` the text named, as offsets `[start, end, start, end…]`; `null` when it did not name them. */
    readonly ranges: readonly number[] | null;
}

/** What every line of the command menu has. */
interface CommandMenuEntryBase {
    /** A nested row's is its parent's and its own joined with `/`; an option's is `${parentId}:${value}`. */
    readonly id: string;
    /** Higher is better, 0 to 100: the match, what the levels above cost and the cost of leaving the context. */
    readonly score: number;
    /** The levels above it, the top's first; none for a row of the level shown. */
    readonly ancestors: readonly CommandMenuAncestor[];
    /** The ids to enter to reach it: for a row with a submenu, its own full path; for any other, its parent's. */
    readonly path: readonly string[];
}

/** A line of the command menu. What it marks is its `match`; a navigation line's is on its `result`. */
export type CommandMenuEntry = CommandMenuEntryBase &
    (
        | /** `match` is `null` when nothing is typed: every action is listed, none is marked. */
          {
              readonly kind: 'command';
              readonly command: Command;
              readonly match: CommandMenuMatch | null;
          }
        /** E4: an option of an action's submenu found by what was typed — "Set Status → In progress". */
        | {
              readonly kind: 'option';
              readonly command: Command;
              readonly option: CommandOption;
              readonly match: CommandMenuMatch;
          }
        | { readonly kind: 'navigation'; readonly result: NavigationResult }
    );

/** The menu's headings: the subject's actions, the screen's, the repository's, the places, the app's; `level` is a submenu's rows, with no heading. */
export type CommandMenuGroupKey = 'level' | 'subject' | 'view' | 'repository' | NavigationGroup | 'app';

/** Entries under one heading. */
export interface CommandMenuGroup {
    readonly key: CommandMenuGroupKey;
    readonly entries: readonly CommandMenuEntry[];
}

/** A submenu the menu is inside of. */
export interface MenuLevel {
    /** The ids entered to get here, its own the last. */
    readonly path: readonly string[];
    /** The rows it offers now. */
    readonly rows: readonly Command[];
}

/** What {@link buildCommandMenu} lists. */
export interface BuildCommandMenuParams {
    readonly query: string;
    /** Every action registered now. */
    readonly commands: readonly Command[];
    /** What the actions act on; `null` when there is none, or the user took it out of the menu (⌫). */
    readonly subject: CommandSubject | null;
    /**
     * The repository (`owner/name`) the screen belongs to, whose actions are offered; `null` when there is none, or
     * the user took it out of the menu (⌫).
     */
    readonly repository: string | null;
    readonly navigation: NavigationData;
    /** Set inside a submenu: only what is under it is listed and found. */
    readonly level?: MenuLevel | null;
}

/** What {@link resolveMenuPath} walks. */
export interface ResolveMenuPathParams {
    /** The ids to enter, from the top. */
    readonly path: readonly string[];
    readonly commands: readonly Command[];
    readonly navigation: NavigationData;
}

/** A level {@link resolveMenuPath} found. */
export interface MenuPathStep extends MenuLevel {
    readonly title: string;
    /** The action it is a level of; `null` for a place or a repository not tracked. */
    readonly command: Command | null;
}

/** Where rows being added sit. */
interface MenuTrail {
    /** The id of the level they are under; `null` at the top. */
    readonly id: string | null;
    readonly path: readonly string[];
    readonly ancestors: readonly CommandMenuAncestor[];
    /** What the levels above cost together. */
    readonly factor: number;
    readonly group: CommandMenuGroupKey;
}

/** A row whose submenu is looked through; its trail is where the row itself sits, but for its own `id` and `path`. */
interface MenuParent extends MenuTrail, MenuRowTexts {
    readonly id: string;
    /** The action whose options are looked through as well. */
    readonly command: Command | null;
    findsAlone(): readonly Command[];
    findsNamed(): readonly Command[];
}

/** The order of the headings while nothing is typed (E1). */
const GROUP_ORDER: readonly CommandMenuGroupKey[] = [
    'level',
    'subject',
    'view',
    'repository',
    'goTo',
    'projects',
    'repositories',
    'items',
    'app',
];

/** How many options of one action typing finds directly. */
const OPTION_LIMIT = 3;

/** What a level the text does not name costs a row under it. */
const CHILD_WEIGHT = 0.6;

/** The same for an option of the subject's action: "in prog" on an opened item is after a value of its status. */
const SUBJECT_OPTION_WEIGHT = 0.8;

/** A nested row below this, before the context's cost, is not shown. */
const NESTED_MIN_SCORE = 20;

/** A nested row must match its name's start or words, maybe with a typo at a word's start. */
const NESTED_MIN_MATCH = 50;

/** A level counts as named by a match in it, no scattered letters and no typo inside a word. */
const ANCESTOR_MIN_MATCH = 40;

/** What leaving the context costs: only orders, it cuts nothing. */
const OUTSIDE_CONTEXT_FACTOR = 0.9;

/**
 * The command menu's level (E1, E3, E4). At the top: the subject's actions — the selection's, else the opened item's,
 * none once the user took the subject out — then the screen's, the repository's (none once it is taken out or
 * when the screen has none), the places to go and the app's; inside a submenu: its rows. Typed text finds
 * actions by title and keywords, places and items in the local copy (`searchNavigation`), and the rows and options
 * of the submenus under them (E4: "in prog" finds "Set Status → In progress"), each paying for the levels above it:
 * words from the start of the text may name those levels, in path order, and the rest goes to the row. The heading
 * with the best match comes first, and the best matches first under it. Typed after `>`, it finds the actions only;
 * `#123` finds the items only.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildCommandMenu(params: BuildCommandMenuParams): CommandMenuGroup[] {
    const { query, subject, repository, navigation, level } = params;
    // E1: `>` first asks for the actions only, no places or items.
    const commandsOnly = query.trimStart().startsWith('>');
    const typed = (commandsOnly ? query.trimStart().slice(1) : query).trim();
    const onlyNumber = isOnlyItemNumber(typed);
    const found = new Map<CommandMenuGroupKey, Map<string, CommandMenuEntry>>();

    const rows = getTopRows();
    for (const { row, score, match } of findMenuRows(typed, rows)) {
        addCommand(row, getRowTrail(row), score, match);
    }

    const roots = rows.flatMap(row => toCommandParent(row, getRowTrail(row)) ?? []);
    if (!level) {
        for (const result of commandsOnly ? [] : searchNavigation(typed, navigation)) {
            addNavigation(result);
        }

        if (!onlyNumber) {
            roots.push(...navigation.places.flatMap(place => toPlaceParent(place) ?? []));
        }
    }

    if (typed !== '' && !onlyNumber) {
        const words = typed.split(/\s+/u);
        const untracked = level ? null : toUntrackedParent(words[0] ?? '', navigation);
        descend(untracked ? [...roots, untracked] : roots, words);
    }

    const groups = GROUP_ORDER.flatMap(key => {
        const entries = [...(found.get(key)?.values() ?? [])];
        const sorted = typed === '' ? entries : limitOptions(entries.toSorted((a, b) => b.score - a.score));
        return sorted.length === 0 ? [] : [{ key, best: sorted[0]?.score ?? 0, entries: sorted }];
    });
    const ordered = typed === '' ? groups : groups.toSorted((a, b) => b.best - a.best);
    return ordered.map(({ key, entries }) => ({ key, entries }));

    function getTopRows() {
        if (onlyNumber) {
            return [];
        }

        return level
            ? level.rows
            : params.commands
                  .filter(command => command.menu !== false && isOffered(command, subject, repository))
                  .toSorted((a, b) => getRepositoryRank(a) - getRepositoryRank(b));
    }

    function getRowTrail(row: Command): MenuTrail {
        return {
            id: level?.path.at(-1) ?? null,
            path: level?.path ?? [],
            ancestors: [],
            factor: 1,
            group: level ? 'level' : getGroup(row.section),
        };
    }

    /**
     * Over what each parent finds unnamed, then over the children of those each start of the text names. One matching
     * call per start over all the parents: per parent it takes over a millisecond among 200 repositories.
     */
    function descend(parents: readonly MenuParent[], words: readonly string[]) {
        if (parents.length === 0) {
            return;
        }

        for (const parent of parents) {
            const unnamed: CommandMenuAncestor = { title: parent.title, ranges: null };
            findChildren(parent, parent.findsAlone(), words, parent.factor * CHILD_WEIGHT, unnamed);
            findOptions(parent, words, parent.factor * getOptionWeight(parent.command), unnamed);
        }

        for (let split = 1; split < words.length; split++) {
            const rest = words.slice(split);
            for (const { row: parent, score, match } of findMenuRows(words.slice(0, split).join(' '), parents)) {
                if (score >= ANCESTOR_MIN_MATCH) {
                    const factor = (parent.factor * (1 + score / 100)) / 2;
                    const ranges = match?.field === 'title' ? match.ranges : null;
                    findChildren(parent, parent.findsNamed(), rest, factor, { title: parent.title, ranges });
                    findOptions(parent, rest, factor, { title: parent.title, ranges });
                }
            }
        }
    }

    function findChildren(
        parent: MenuParent,
        children: readonly Command[],
        words: readonly string[],
        factor: number,
        ancestor: CommandMenuAncestor,
    ) {
        const offered = getOfferedChildren(children);
        if (offered.length === 0) {
            return;
        }

        const trail: MenuTrail = { ...parent, factor, ancestors: [...parent.ancestors, ancestor] };
        for (const { row, score, match } of findMenuRows(words.join(' '), offered)) {
            if (isNestedMatch(score, factor)) {
                addCommand(row, trail, score, match);
            }
        }

        descend(
            offered.flatMap(child => toCommandParent(child, trail) ?? []),
            words,
        );
    }

    function findOptions(parent: MenuParent, words: readonly string[], factor: number, ancestor: CommandMenuAncestor) {
        const text = words.join(' ');
        // A search's options are its answers: only its own submenu asks for them.
        if (!parent.command?.options || parent.command.search || text.length < 2) {
            return;
        }

        const { command } = parent;
        for (const { option, score, ranges } of findOptionLabels(text, parent.command.options().options)) {
            if (isNestedMatch(score, factor)) {
                add(parent.group, {
                    kind: 'option',
                    id: `${parent.id}:${option.value}`,
                    command,
                    option,
                    match: { field: 'title', text: option.label, ranges },
                    score: score * factor * getContextFactor(parent.group),
                    ancestors: [...parent.ancestors, ancestor],
                    path: parent.path,
                });
            }
        }
    }

    function addCommand(command: Command, trail: MenuTrail, score: number, match: CommandMenuMatch | null) {
        const id = getRowId(command, trail);
        add(trail.group, {
            kind: 'command',
            id,
            command,
            match,
            score: score * trail.factor * getContextFactor(trail.group),
            ancestors: trail.ancestors,
            path: command.options || command.children ? [...trail.path, id] : trail.path,
        });
    }

    function addNavigation(result: NavigationResult) {
        const group = getNavigationGroup(result);
        const id = getNavigationId(result);
        add(group, {
            kind: 'navigation',
            id,
            result,
            score: result.score * getContextFactor(group),
            ancestors: [],
            path: hasNavigationSubmenu(result, navigation) ? [id] : [],
        });
    }

    /** The best way of finding a row is the one that counts. */
    function add(group: CommandMenuGroupKey, entry: CommandMenuEntry) {
        const entries = found.get(group) ?? new Map<string, CommandMenuEntry>();
        const kept = entries.get(entry.id);
        if (!kept || entry.score > kept.score) {
            entries.set(entry.id, entry);
        }

        found.set(group, entries);
    }
}

/**
 * The levels a path of ids leads through, from the top; where a level is gone (a `when` changed), it ends at the last
 * one still there. A root is an action's id, a place (`place:…`) or a repository not tracked (`repository:owner/name`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveMenuPath(params: ResolveMenuPathParams): MenuPathStep[] {
    const steps: MenuPathStep[] = [];
    for (const id of params.path) {
        const last = steps.at(-1);
        const step = last ? findChildStep(last, id) : findRootStep(id, params);
        if (!step) {
            break;
        }

        steps.push(step);
    }

    return steps;
}

function findRootStep(id: string, params: ResolveMenuPathParams): MenuPathStep | null {
    const { commands, navigation } = params;
    const path = [id];
    if (id.startsWith('place:')) {
        const place = navigation.places.find(candidate => `place:${candidate.id}` === id);
        return place?.children
            ? { title: place.title, command: null, path, rows: getOfferedChildren(place.children()) }
            : null;
    }

    if (id.startsWith('repository:')) {
        const nameWithOwner = id.slice('repository:'.length);
        const children = navigation.repositoryChildren?.(nameWithOwner);
        return children ? { title: nameWithOwner, command: null, path, rows: getOfferedChildren(children) } : null;
    }

    // Its key opens a submenu whether or not the menu offers the action itself.
    const command = commands.find(candidate => candidate.id === id);
    return command && (command.when?.() ?? true) ? toCommandStep(command, path) : null;
}

function findChildStep(parent: MenuPathStep, id: string) {
    const parentId = parent.path.at(-1) ?? '';
    const command = parent.rows.find(row => `${parentId}/${row.id}` === id);
    return command ? toCommandStep(command, [...parent.path, id]) : null;
}

function toCommandStep(command: Command, path: readonly string[]): MenuPathStep | null {
    if (!command.options && !command.children) {
        return null;
    }

    return { title: command.title, command, path, rows: getOfferedChildren(command.children?.() ?? []) };
}

/** The section checks are the top level's: a nested row is shown by what is above it. */
function getOfferedChildren(children: readonly Command[]) {
    return children.filter(child => child.menu !== false && (child.when?.() ?? true));
}

function toCommandParent(command: Command, trail: MenuTrail): MenuParent | null {
    // A search has no options to look through, so only children make it a parent.
    if (!command.children && (!command.options || command.search)) {
        return null;
    }

    const id = getRowId(command, trail);
    return {
        ...trail,
        id,
        title: command.title,
        keywords: command.keywords,
        path: [...trail.path, id],
        command,
        findsAlone: () => command.foundAlone?.() ?? command.children?.() ?? [],
        findsNamed: () => command.children?.() ?? [],
    };
}

function toPlaceParent(place: NavigationPlace): MenuParent | null {
    if (!place.children) {
        return null;
    }

    const id = `place:${place.id}`;
    return {
        id,
        title: place.title,
        detail: place.detail,
        keywords: place.keywords,
        path: [id],
        ancestors: [],
        factor: 1,
        group: place.group,
        command: null,
        findsAlone: () => place.foundAlone?.() ?? place.children?.() ?? [],
        findsNamed: () => place.children?.() ?? [],
    };
}

/** A repository not tracked, named by the text's first word: its children are found only so. */
function toUntrackedParent(word: string, navigation: NavigationData): MenuParent | null {
    const nameWithOwner = findUntrackedRepository(word, navigation);
    if (nameWithOwner === null || !navigation.repositoryChildren) {
        return null;
    }

    const id = `repository:${nameWithOwner}`;
    return {
        id,
        title: nameWithOwner,
        path: [id],
        ancestors: [],
        factor: 1,
        group: 'repositories',
        command: null,
        findsAlone: () => [],
        findsNamed: () => navigation.repositoryChildren?.(nameWithOwner) ?? [],
    };
}

function getRowId(command: Command, trail: MenuTrail) {
    return trail.id === null ? command.id : `${trail.id}/${command.id}`;
}

function isNestedMatch(score: number, factor: number) {
    return score >= NESTED_MIN_MATCH && score * factor >= NESTED_MIN_SCORE;
}

function getOptionWeight(command: Command | null) {
    return command?.section === 'item' || command?.section === 'selection' ? SUBJECT_OPTION_WEIGHT : CHILD_WEIGHT;
}

/** Sorted best first: the best of each action's options stay, however they were found. */
function limitOptions(entries: readonly CommandMenuEntry[]) {
    const counts = new Map<string, number>();
    return entries.filter(entry => {
        if (entry.kind !== 'option') {
            return true;
        }

        const parentId = entry.path.at(-1) ?? '';
        const count = (counts.get(parentId) ?? 0) + 1;
        counts.set(parentId, count);
        return count <= OPTION_LIMIT;
    });
}

/**
 * The menu offers the subject's actions only for its subject — the selection's, or the opened item's — and the
 * repository's only while it has a repository.
 */
function isOffered(command: Command, subject: CommandSubject | null, repository: string | null) {
    if (command.section === 'repository' && repository === null) {
        return false;
    }

    if ((command.section === 'item' || command.section === 'selection') && subject?.kind !== command.section) {
        return false;
    }

    return command.when?.() ?? true;
}

/**
 * The repository's sections on its view are on keys, and the view registers them after the app's other lines of it:
 * they lead their group all the same, as they do off the view, where they are registered first.
 */
function getRepositoryRank(command: Command) {
    return command.section === 'repository' && command.key === undefined ? 1 : 0;
}

function getGroup(section: CommandSection): CommandMenuGroupKey {
    switch (section) {
        case 'item':
        case 'selection':
            return 'subject';
        case 'view':
            return 'view';
        case 'repository':
            return 'repository';
        case 'app':
            return 'app';
        default:
            return assertNever(section);
    }
}

function getContextFactor(group: CommandMenuGroupKey) {
    switch (group) {
        case 'level':
        case 'subject':
        case 'view':
        case 'repository':
            return 1;
        case 'goTo':
        case 'projects':
        case 'repositories':
        case 'items':
        case 'app':
            return OUTSIDE_CONTEXT_FACTOR;
        default:
            return assertNever(group);
    }
}

function getNavigationGroup(result: NavigationResult) {
    switch (result.kind) {
        case 'place':
            return result.place.group;
        case 'item':
            return 'items';
        case 'repository':
            return 'repositories';
        default:
            return assertNever(result);
    }
}

function hasNavigationSubmenu(result: NavigationResult, navigation: NavigationData) {
    switch (result.kind) {
        case 'place':
            return result.place.children !== undefined;
        case 'item':
            return false;
        case 'repository':
            return navigation.repositoryChildren !== undefined;
        default:
            return assertNever(result);
    }
}

function getNavigationId(result: NavigationResult) {
    switch (result.kind) {
        case 'place':
            return `place:${result.place.id}`;
        case 'item':
            return `item:${result.item.id}`;
        case 'repository':
            return `repository:${result.nameWithOwner}`;
        default:
            return assertNever(result);
    }
}
