import type { Translator } from '@nzyme/i18n/Translator.js';
import { assert } from '@nzyme/utils/assert.js';

import type { Command } from './CommandTypes.js';
import type { AppCommand, AppCommandFamily, CommandPlaces } from './defineAppCommand.js';
import { keyOf } from './keyOf.js';

/** The fields of a {@link Command} that come from its definition, never from a place (commands D1). */
type DefinedField = 'id' | 'title' | 'icon' | 'key' | 'otherKeys' | 'keywords' | 'priority' | 'place';

/** Which of its places a binding offers a definition in: named when the definition has several. */
export type CommandBindingPlace<TPlaces extends CommandPlaces> = TPlaces extends readonly [infer TPlace]
    ? { readonly place?: TPlace }
    : { readonly place: TPlaces[number] };

/**
 * What a place says of a defined command: what it does there and when it can (`run`, `when`, `unavailable`, `detail`,
 * a picker's `options`…), and the heading it sits under there (`section`). `title` only names what a family's number
 * picks (`Go to "Backlog" view`).
 */
export type CommandBinding<TPlaces extends CommandPlaces = CommandPlaces> = Omit<Command, DefinedField> & {
    readonly title?: string;
    /** Words of this place it is found by too (a repository's name), after the definition's own. */
    readonly keywords?: readonly string[];
    /**
     * `false`: offered here without its key, in menus only — the key belongs to what the keyboard is on (a repository's
     * "Open on GitHub", where `O` opens the selected row or the opened item).
     */
    readonly keyed?: false;
} & CommandBindingPlace<TPlaces>;

/** A family's binding: what its number does, or `null` where the screen has nothing at that number. */
export type CommandFamilyBinding<TPlaces extends CommandPlaces = CommandPlaces> = (
    number: number,
) => CommandBinding<TPlaces> | null;

/**
 * The registry's command for a definition offered with this binding — a plain {@link Command}, so a context menu can
 * show it too. Its id is `<place>.<id>`, so one definition offered in two places at once (a list and the item beside
 * it) gives two commands.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function bindCommand<const TPlaces extends CommandPlaces>(
    definition: AppCommand<TPlaces>,
    binding: CommandBinding<TPlaces>,
    t: Translator,
): Command;
/**
 * The registry's commands for a numbered family: one per number the binding gives, on that number's key, its id
 * `<place>.<id>.<number>`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function bindCommand<const TPlaces extends CommandPlaces>(
    definition: AppCommandFamily<TPlaces>,
    binding: CommandFamilyBinding<TPlaces>,
    t: Translator,
): Command[];
/** @__NO_SIDE_EFFECTS__ */
export function bindCommand<const TPlaces extends CommandPlaces>(
    definition: AppCommand<TPlaces> | AppCommandFamily<TPlaces>,
    binding: CommandBinding<TPlaces> | CommandFamilyBinding<TPlaces>,
    t: Translator,
): Command | Command[] {
    if (definition.kind === 'command') {
        assert(typeof binding !== 'function', 'A command is bound by an object, a family by a function.');
        return toCommand(definition, binding, t, { id: definition.id, key: keyOf(definition) });
    }

    assert(typeof binding === 'function', 'A command is bound by an object, a family by a function.');
    const commands: Command[] = [];
    for (let number = definition.numbers.first; number <= definition.numbers.last; number++) {
        const bound = binding(number);
        if (bound) {
            commands.push(toCommand(definition, bound, t, { id: `${definition.id}.${number}`, key: `${number}` }));
        }
    }

    return commands;
}

/** What tells a family's numbers apart. */
interface BoundKey {
    readonly id: string;
    readonly key: string | undefined;
}

function toCommand<TPlaces extends CommandPlaces>(
    definition: AppCommand<TPlaces> | AppCommandFamily<TPlaces>,
    binding: CommandBinding<TPlaces>,
    t: Translator,
    bound: BoundKey,
): Command {
    const { keyed, keywords, ...rest } = binding;
    const place = rest.place ?? definition.places[0];
    const ownKeywords = definition.keywords?.map(keyword => t(keyword)) ?? [];
    return {
        ...rest,
        id: `${place}.${bound.id}`,
        title: rest.title ?? t(definition.title),
        icon: definition.icon,
        key: keyed === false ? undefined : bound.key,
        otherKeys: keyed === false || definition.kind === 'family' ? undefined : definition.otherKeys,
        keywords: keywords || definition.keywords ? [...ownKeywords, ...(keywords ?? [])] : undefined,
        priority: definition.priority,
        place,
    };
}
