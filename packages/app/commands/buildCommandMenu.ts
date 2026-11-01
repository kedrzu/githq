import { assertNever } from '@nzyme/utils/assertNever.js';

import { findOptionLabels } from '@/components/filterOptions.js';

import type { Command, CommandOption, CommandSection, CommandSubject } from './CommandTypes.js';
import { findMenuRows } from './findMenuRows.js';
import type { CommandMenuMatch } from './findMenuRows.js';
import { isOnlyItemNumber, searchNavigation } from './searchNavigation.js';
import type { NavigationData, NavigationGroup, NavigationResult } from './searchNavigation.js';

/** A line of the command menu. What it marks is its `match`; a navigation line's is on its `result`. */
export type CommandMenuEntry =
    /** `match` is `null` when nothing is typed: every action is listed, none is marked. */
    | {
          readonly kind: 'command';
          readonly id: string;
          readonly command: Command;
          readonly match: CommandMenuMatch | null;
      }
    /** E4: an option of an action's submenu found by what was typed — "Set Status → In progress". */
    | {
          readonly kind: 'option';
          readonly id: string;
          readonly command: Command;
          readonly option: CommandOption;
          readonly match: CommandMenuMatch;
      }
    | { readonly kind: 'navigation'; readonly id: string; readonly result: NavigationResult };

/** The menu's headings: the subject's actions, the screen's, the places, the app's. */
export type CommandMenuGroupKey = 'subject' | 'view' | NavigationGroup | 'app';

/** Entries under one heading. */
export interface CommandMenuGroup {
    readonly key: CommandMenuGroupKey;
    readonly entries: readonly CommandMenuEntry[];
}

/** What {@link buildCommandMenu} lists. */
export interface BuildCommandMenuParams {
    readonly query: string;
    /** Every action registered now. */
    readonly commands: readonly Command[];
    /** What the actions act on; `null` when there is none, or the user took it out of the menu (⌫). */
    readonly subject: CommandSubject | null;
    readonly navigation: NavigationData;
}

/** The order of the headings while nothing is typed (E1). */
const GROUP_ORDER: readonly CommandMenuGroupKey[] = [
    'subject',
    'view',
    'goTo',
    'projects',
    'repositories',
    'items',
    'app',
];

/** How many options of one action typing finds directly. */
const OPTION_LIMIT = 3;

/** An option found directly must match its name's start or words, maybe with a typo at a word's start. */
const OPTION_MIN_SCORE = 50;

/**
 * The command menu's top level (E1, E3, E4): the subject's actions — the selection's, else the opened item's,
 * none once the user took the subject out — then the screen's, the places to go and the app's. Typed text finds
 * actions by title and keywords, places and items in the local copy (`searchNavigation`), and — from two letters —
 * the options of the actions' submenus directly (E4: "in prog" finds "Set Status → In progress"); the heading with
 * the best match comes first, and the best matches first under it. Typed after `>`, it finds the actions only;
 * `#123` finds the items only.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildCommandMenu(params: BuildCommandMenuParams): CommandMenuGroup[] {
    const { query, subject } = params;
    // E1: `>` first asks for the actions only, no places or items.
    const commandsOnly = query.trimStart().startsWith('>');
    const typed = (commandsOnly ? query.trimStart().slice(1) : query).trim();
    const scored = new Map<CommandMenuGroupKey, { entry: CommandMenuEntry; score: number }[]>();

    const offered = isOnlyItemNumber(typed)
        ? []
        : params.commands.filter(command => command.menu !== false && isOffered(command, subject));
    const foundCommands = new Map(findMenuRows(typed, offered).map(found => [found.row, found]));
    for (const command of offered) {
        const group = getGroup(command.section);
        const found = foundCommands.get(command);
        if (found) {
            add(group, { kind: 'command', id: command.id, command, match: found.match }, found.score);
        }

        if (command.options && typed.length >= 2) {
            for (const { option, score, ranges } of findOptions(typed, command)) {
                const match: CommandMenuMatch = { field: 'title', text: option.label, ranges };
                // Above the action itself: the value is what was typed.
                add(group, { kind: 'option', id: `${command.id}:${option.value}`, command, option, match }, score + 1);
            }
        }
    }

    for (const result of commandsOnly ? [] : searchNavigation(typed, params.navigation)) {
        const group = result.kind === 'place' ? result.place.group : result.kind === 'item' ? 'items' : 'repositories';
        add(group, { kind: 'navigation', id: getNavigationId(result), result }, result.score);
    }

    const groups = GROUP_ORDER.flatMap(key => {
        const entries = scored.get(key) ?? [];
        const sorted = typed === '' ? entries : entries.toSorted((a, b) => b.score - a.score);
        return sorted.length === 0 ? [] : [{ key, best: sorted[0]?.score ?? 0, entries: sorted.map(e => e.entry) }];
    });
    const ordered = typed === '' ? groups : groups.toSorted((a, b) => b.best - a.best);
    return ordered.map(({ key, entries }) => ({ key, entries }));

    function add(group: CommandMenuGroupKey, entry: CommandMenuEntry, score: number) {
        const entries = scored.get(group) ?? [];
        entries.push({ entry, score });
        scored.set(group, entries);
    }
}

/** The menu offers the subject's actions only for its subject: the selection's, or the opened item's. */
function isOffered(command: Command, subject: CommandSubject | null) {
    if ((command.section === 'item' || command.section === 'selection') && subject?.kind !== command.section) {
        return false;
    }

    return command.when?.() ?? true;
}

function getGroup(section: CommandSection): CommandMenuGroupKey {
    switch (section) {
        case 'item':
        case 'selection':
            return 'subject';
        case 'view':
            return 'view';
        case 'app':
            return 'app';
        default:
            return assertNever(section);
    }
}

function findOptions(typed: string, command: Command) {
    return findOptionLabels(typed, command.options?.().options ?? [])
        .filter(match => match.score >= OPTION_MIN_SCORE)
        .slice(0, OPTION_LIMIT);
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
