import { assertNever } from '@nzyme/utils/assertNever.js';

import type { Command, CommandOption, CommandSection, CommandSubject } from './CommandTypes.js';
import { scoreText } from './scoreText.js';
import { searchNavigation } from './searchNavigation.js';
import type { NavigationData, NavigationGroup, NavigationResult } from './searchNavigation.js';

/** A line of the command menu. */
export type CommandMenuEntry =
    | { readonly kind: 'command'; readonly id: string; readonly command: Command }
    /** E4: an option of an action's submenu found by what was typed — "Set Status → In progress". */
    | { readonly kind: 'option'; readonly id: string; readonly command: Command; readonly option: CommandOption }
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

/** An option found directly must match its name's start or words — not scattered letters. */
const OPTION_MIN_SCORE = 60;

/**
 * The command menu's top level (E1, E3, E4): the subject's actions — the selection's, else the opened item's,
 * none once the user took the subject out — then the screen's, the places to go and the app's. Typed text finds
 * actions by title and keywords, places and items in the local copy (`searchNavigation`), and — from two letters —
 * the options of the actions' submenus directly (E4: "in prog" finds "Set Status → In progress"); the heading with
 * the best match comes first, and the best matches first under it. Typed after `>`, it finds the actions only.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildCommandMenu(params: BuildCommandMenuParams): CommandMenuGroup[] {
    const { query, subject } = params;
    // E1: `>` first asks for the actions only, no places or items.
    const commandsOnly = query.trimStart().startsWith('>');
    const typed = (commandsOnly ? query.trimStart().slice(1) : query).trim();
    const scored = new Map<CommandMenuGroupKey, { entry: CommandMenuEntry; score: number }[]>();

    for (const command of params.commands) {
        if (command.menu === false || !isOffered(command, subject)) {
            continue;
        }

        const group = getGroup(command.section);
        const score = scoreCommand(typed, command);
        if (score !== null) {
            add(group, { kind: 'command', id: command.id, command }, score);
        }

        if (command.options && typed.length >= 2) {
            for (const { option, score: optionScore } of findOptions(typed, command)) {
                // Above the action itself: the value is what was typed.
                add(group, { kind: 'option', id: `${command.id}:${option.value}`, command, option }, optionScore + 1);
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

/**
 * The options of an action's submenu that typed text finds, best first.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function filterCommandOptions(query: string, options: readonly CommandOption[]): CommandOption[] {
    const typed = query.trim();
    if (typed === '') {
        return [...options];
    }

    return options
        .flatMap(option => {
            const score = Math.max(
                scoreText(typed, option.label) ?? -1,
                (scoreText(typed, option.detail ?? '') ?? 0) - 30,
            );
            return score < 0 ? [] : [{ option, score }];
        })
        .toSorted((a, b) => b.score - a.score)
        .map(({ option }) => option);
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

function scoreCommand(typed: string, command: Command) {
    const scores = [command.title, ...(command.keywords ?? [])].map(text => scoreText(typed, text));
    const found = scores.filter(score => score !== null);
    return found.length === 0 ? null : Math.max(...found);
}

function findOptions(typed: string, command: Command) {
    const found: { option: CommandOption; score: number }[] = [];
    for (const option of command.options?.().options ?? []) {
        const score = scoreText(typed, option.label);
        if (score !== null && score >= OPTION_MIN_SCORE) {
            found.push({ option, score });
        }
    }

    return found.toSorted((a, b) => b.score - a.score).slice(0, OPTION_LIMIT);
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
