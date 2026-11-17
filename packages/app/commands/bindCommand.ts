import type { Translator } from '@nzyme/i18n/Translator.js';
import { assert } from '@nzyme/utils/assert.js';

import type { Command } from './CommandTypes.js';
import type { AppCommand, AppCommandFamily, CommandPlaces } from './defineAppCommand.js';
import { keyOf } from './keyOf.js';

/** The fields of a {@link Command} that come from its definition, never from a place (commands D1). */
type DefinedField = 'id' | 'title' | 'key' | 'otherKeys' | 'keywords' | 'priority' | 'place' | 'definition';

/** Which of its places a binding offers a definition in: named when the definition has several. */
export type CommandBindingPlace<TPlaces extends CommandPlaces> = TPlaces extends readonly [infer TPlace]
    ? { readonly place?: TPlace }
    : { readonly place: TPlaces[number] };

/**
 * What a place says of a defined command: what it does there and when it can (`run`, `when`, `unavailable`, `detail`,
 * a picker's `options`…), and the heading it sits under there (`section`). `title` only names what a family's number
 * picks (`Go to "Backlog" view`), what the command acts on here ("Untrack" for "Remove") or, with `icon`, the way a
 * toggle goes here ("Show as board").
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
    /**
     * `false`: run here by its key alone, its other keys being the place's own (an opened item's page scrolls by ↓/↑,
     * so `J`/`K` alone step through the list it was opened from).
     */
    readonly otherKeys?: false;
} & CommandBindingPlace<TPlaces>;

/**
 * The registry's commands for a numbered family: one per binding, the n-th binding on the family's n-th number (from
 * `numbers.first`) and its key, its id `<place>.<id>.<number>`. A `null` binding leaves its number out (a section the
 * screen doesn't show) and gives no command, so the result holds only those bound, in order. Numbers past the family's
 * last are offered with no key: a project's tenth saved view is still gone to from the menus. Declared before the single
 * command's overload, so bindings a caller builds with `map` keep their literal types (`section: 'view'`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function bindCommand<const TPlaces extends CommandPlaces>(
    definition: AppCommandFamily<TPlaces>,
    bindings: readonly (CommandBinding<TPlaces> | null)[],
    t: Translator,
): Command[];
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
/** @__NO_SIDE_EFFECTS__ */
export function bindCommand<const TPlaces extends CommandPlaces>(
    definition: AppCommand<TPlaces> | AppCommandFamily<TPlaces>,
    binding: CommandBinding<TPlaces> | readonly (CommandBinding<TPlaces> | null)[],
    t: Translator,
): Command | Command[] {
    if (definition.kind === 'command') {
        assert(!isBindingList(binding), 'A command is bound by an object, a family by an array.');
        return toCommand(definition, binding, t, { id: definition.id, key: keyOf(definition) });
    }

    assert(isBindingList(binding), 'A command is bound by an object, a family by an array.');
    return binding.flatMap((bound, index) => {
        const number = definition.numbers.first + index;
        return bound
            ? [toCommand(definition, bound, t, { id: `${definition.id}.${number}`, key: keyOf(definition, number) })]
            : [];
    });
}

/** What tells a family's numbers apart. */
interface BoundKey {
    readonly id: string;
    readonly key: string | undefined;
}

function isBindingList<TPlaces extends CommandPlaces>(
    binding: CommandBinding<TPlaces> | readonly (CommandBinding<TPlaces> | null)[],
): binding is readonly (CommandBinding<TPlaces> | null)[] {
    return Array.isArray(binding);
}

function toCommand<TPlaces extends CommandPlaces>(
    definition: AppCommand<TPlaces> | AppCommandFamily<TPlaces>,
    binding: CommandBinding<TPlaces>,
    t: Translator,
    bound: BoundKey,
): Command {
    const { keyed, keywords, otherKeys, ...rest } = binding;
    const place = rest.place ?? definition.places[0];
    const ownKeywords = definition.keywords?.map(keyword => t(keyword)) ?? [];
    return {
        ...rest,
        id: `${place}.${bound.id}`,
        title: rest.title ?? t(definition.title),
        icon: rest.icon ?? definition.icon,
        key: keyed === false ? undefined : bound.key,
        otherKeys:
            keyed === false || otherKeys === false || definition.kind === 'family' ? undefined : definition.otherKeys,
        keywords: keywords || definition.keywords ? [...ownKeywords, ...(keywords ?? [])] : undefined,
        priority: definition.priority,
        place,
        definition,
    };
}
